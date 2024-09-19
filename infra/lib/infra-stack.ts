import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3"
import * as ecr from "aws-cdk-lib/aws-ecr"
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as kendra from "aws-cdk-lib/aws-kendra";
import * as ses from "aws-cdk-lib/aws-ses";
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';


export class PennyInfraStack extends cdk.Stack {
  private customerTable: dynamodb.Table
  private verifyIdLambda: lambda.Function
  private verifyFaceLambda: lambda.Function
  private getAccountLambda: lambda.Function
  private createAccountLambda: lambda.Function
  private api: apigateway.RestApi
  private idBucket: s3.Bucket
  private catalogBucket: s3.Bucket
  private kendraIndex: kendra.CfnIndex
  private llmService: ecs.FargateService

  private sesBankEmail: cdk.CfnParameter
  private sesCustomerEmail: cdk.CfnParameter
  private llmImageTag: cdk.CfnParameter


  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    this.createParameters()

    this.createCustomerTable()
    this.createIDsBucket()

    this.createLambda_verifyId()
    this.createLambda_verifyFace()
    this.createLambda_getAccount()
    this.createLambda_createAccount()
    
    this.createApi()
    this.createSesIdentities()
    this.createRetriever()
    this.createLLM()
  }

  createParameters = () => {
    this.sesBankEmail = new cdk.CfnParameter(this, 'SesBankEmail', {
      type: 'String',
      noEcho: true,
      allowedPattern : ".+"
    })

    this.sesCustomerEmail = new cdk.CfnParameter(this, 'SesCustomerEmail', {
      type: 'String',
      noEcho: true,
      allowedPattern : ".+"
    })

    this.llmImageTag = new cdk.CfnParameter(this, 'LLMImageTag', {
      type: 'String',
      noEcho: true,
      allowedPattern : ".+",
    }) 
  }

  createCustomerTable = () => {
    this.customerTable = new dynamodb.Table(this, 'CustomerTable', { 
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING }, 
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, 
      removalPolicy: RemovalPolicy.DESTROY,
    })

  }

  createLambda_verifyId = () => {
    this.verifyIdLambda = new lambda.Function(this, 'VerifyId', {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset('../api/lambdas'),
      handler: 'verify-id.main',
      timeout: Duration.seconds(10),
      environment: {
        'bucketName': this.idBucket.bucketName
      }
    })
    this.verifyIdLambda.addToRolePolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW, 
        actions: ['textract:AnalyzeID', 's3:Get*', 's3:List*', 's3:Describe*'],
        resources: ['*']
      }),
    )
  }

  createLambda_verifyFace = () => {
    this.verifyFaceLambda = new lambda.Function(this, 'VerifyFace', {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset('../api/lambdas'),
      handler: 'verify-face.main',
      timeout: Duration.seconds(10),
      environment: {
        'bucketName': this.idBucket.bucketName
      }
    })

    this.verifyFaceLambda.addToRolePolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW, 
        actions: ['s3:Get*', 's3:List*', 's3:Describe*'],
        resources: [
          `arn:aws:s3:::${this.idBucket.bucketName}`,
          `arn:aws:s3:::${this.idBucket.bucketName}/*`
        ]
      }),
    )

    this.verifyFaceLambda.addToRolePolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW, 
        actions: ['rekognition:CompareFaces'],
        resources: [
          `*`,
        ]
      }),
    )
  }

  createLambda_getAccount = () => {
    this.getAccountLambda = new lambda.Function(this, 'GetAccount', {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset('../api/lambdas'),
      handler: 'get-account.main',
      environment: {
        'tableName': this.customerTable.tableName,
      }
    })

    this.getAccountLambda.addToRolePolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW, 
        actions: ['dynamodb:GetItem'],
        resources: [this.customerTable.tableArn]
      }),
    )
  }

  createLambda_createAccount = () => {
    this.createAccountLambda = new lambda.Function(this, 'CreateAccount', {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset('../api/lambdas'),
      handler: 'create-account.main',
      environment: {
        'tableName': this.customerTable.tableName,
        'sesIdentityEmail': this.sesBankEmail.valueAsString
      }
    })

    this.createAccountLambda.addToRolePolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW, 
        actions: ['dynamodb:PutItem'],
        resources: [this.customerTable.tableArn]
      }),
    )

    this.createAccountLambda.addToRolePolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW, 
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: [
          `arn:aws:ses:${this.region}:${this.account}:identity/*`,
        ],
      }),
    )
  }
 
  private defaultCorsPreflightOptions =  {
    allowHeaders: [
      'Content-Type',
      'X-Amz-Date',
      'Authorization',
      'X-Api-Key',
    ],
    allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'DELETE'],
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
  }

  private integrationResponse: apigateway.IntegrationResponse = {
    statusCode: "200",
    contentHandling: apigateway.ContentHandling.CONVERT_TO_TEXT,
    responseParameters: {
      'method.response.header.Content-Type': "'application/json'",
      'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
      'method.response.header.Access-Control-Allow-Origin': "'*'",
      'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
    },
  }

  private methodResponse: apigateway.MethodResponse = {
    statusCode: "200", 
    responseModels: {"application/json": apigateway.Model.EMPTY_MODEL},
    responseParameters: {
      'method.response.header.Content-Type': true,
      'method.response.header.Access-Control-Allow-Headers': true,
      'method.response.header.Access-Control-Allow-Methods': true,
      'method.response.header.Access-Control-Allow-Origin': true
    }
  }
  

  createApi = () => {
    this.api = new apigateway.RestApi(this, `PennyInfraAPI`, {
      description: 'Penny App API',
      deployOptions: {
        stageName: 'test'
      },
      defaultCorsPreflightOptions: this.defaultCorsPreflightOptions,
      deploy: true
    });

    this.createApi_account()
    this.createApi_verifyId()
    this.createApi_verifyFace()
  }

  createApi_account = () => {
    const mappingTemplate = {
      "email" : "$input.params('email')",
    }

    const account = this.api.root.addResource('account', {
      defaultCorsPreflightOptions: this.defaultCorsPreflightOptions,
    })

    account.addMethod('GET', new apigateway.LambdaIntegration(this.getAccountLambda, {
        proxy: false,
        integrationResponses: [this.integrationResponse],
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
        requestTemplates: { "application/json": JSON.stringify(mappingTemplate) },
      }),
      {methodResponses: [this.methodResponse]},
    )

    account.addMethod('POST', new apigateway.LambdaIntegration(this.createAccountLambda, {
        proxy: false,
        integrationResponses: [this.integrationResponse],
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      }),
      {methodResponses: [this.methodResponse]}
    )
  }


  createApi_verifyId = () => {
    const verifyId = this.api.root.addResource('verifyId', {
      defaultCorsPreflightOptions: this.defaultCorsPreflightOptions,
    });

    verifyId.addMethod('POST', new apigateway.LambdaIntegration(this.verifyIdLambda, {
        proxy: false,
        integrationResponses: [this.integrationResponse],
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      }),
      {methodResponses: [this.methodResponse]}
    )
  }

  createApi_verifyFace = () => {
    const verifyFace = this.api.root.addResource('verifyFace', {
      defaultCorsPreflightOptions: this.defaultCorsPreflightOptions,
    });

    verifyFace.addMethod('POST', new apigateway.LambdaIntegration(this.verifyFaceLambda, {
        proxy: false,
        integrationResponses: [this.integrationResponse],
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
      }),
      {methodResponses: [this.methodResponse]}
    )
  }

  createIDsBucket = () => {
    this.idBucket = new s3.Bucket(this, 'IdBucket', {
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    this.idBucket.grantRead(new iam.AccountRootPrincipal());
  }

  createSesIdentities = () => {
    const bankIdentity = new ses.EmailIdentity(this, 'SesBankIdentity', {
      identity: ses.Identity.email(this.sesBankEmail.valueAsString),
    })

    const customerIdentity = new ses.EmailIdentity(this, 'SesCustomerIdentity', {
      identity: ses.Identity.email(this.sesCustomerEmail.valueAsString),
    })
  }

  createRetriever = () => {
    this.catalogBucket = new s3.Bucket(this, 'AnyBankCatalogBucket', {
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    this.catalogBucket.grantRead(new iam.AccountRootPrincipal());

    new s3deploy.BucketDeployment(this, 'BucketDeployment', {
      destinationBucket: this.catalogBucket,
      sources: [s3deploy.Source.asset('./data')]
    })

    const role = new iam.Role(this, 'KendraRole', {
      assumedBy: new iam.ServicePrincipal('kendra.amazonaws.com'),
    })

    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
      ],
      resources: ['*'],
      conditions: {
        'StringEquals': {
          'cloudwatch:namespace': 'AWS/Kendra'
        }
      }
    }));

    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:DescribeLogGroups',
        'logs:CreateLogGroup',
        'logs:PutLogEvents'
      ],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/kendra/*`,
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/kendra/*:log-stream:*`
      ]
    }));

    role.addToPolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW, 
        actions: ['s3:Get*', 's3:List*', 's3:Describe*'],
        resources: [
          `arn:aws:s3:::${this.catalogBucket.bucketName}`,
          `arn:aws:s3:::${this.catalogBucket.bucketName}/*`
        ]
      }),
    )

    this.kendraIndex = new kendra.CfnIndex(this, 'PennyIndex', {
      edition: 'DEVELOPER_EDITION',
      name: 'PennyIndex',
      roleArn: role.roleArn,
    })

    const dataSource = new kendra.CfnDataSource(this, 'PennyDataSource', {
      indexId: this.kendraIndex.attrId,
      roleArn: role.roleArn,
      name: 'AnyBankDataSource',
      type: 'S3',
      dataSourceConfiguration: {
        s3Configuration: {
          bucketName: this.catalogBucket.bucketName,
        }, 
      }, 
      schedule: "cron(0/5 * * * ? *)",  // sync data source every 5 mins 
    })
  }


  createLLM = () => {
    const vpc = new ec2.Vpc(this, 'LLMVpc', {
      subnetConfiguration: [
        { subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24, name: "public-" },
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24, name: "private-" }
      ]
    })

    const sg = new ec2.SecurityGroup(this, 'LLMSG', {
      vpc: vpc,
      allowAllOutbound: true
    })

    const cluster = new ecs.Cluster(this, "LLMCluster", {
      vpc: vpc
    })

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'LLMTaskDef', {
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
      },
      cpu: 1024,
      memoryLimitMiB: 3072
    })

    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['*'], 
      actions: ['bedrock:InvokeModel']
    }));

    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [`${this.idBucket.bucketArn}/*`],
      actions: ['s3:PutObject']
    }));

    taskDefinition.addToTaskRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [this.kendraIndex.attrArn],
      actions: ['kendra:Retrieve']
    }));

    const container = taskDefinition.addContainer("LLMContainer", {
      image: ecs.ContainerImage.fromEcrRepository(
        ecr.Repository.fromRepositoryName(this, 'EcrRepo', "penny-workshop"),
        this.llmImageTag.valueAsString
      ),
      logging: ecs.LogDrivers.awsLogs({streamPrefix: 'penny-llm'}),
      environment: {
        'apiEndpoint': this.api.url,
        'kendraIndexId': this.kendraIndex.attrId,
        'idBucketName': this.idBucket.bucketName
      },
      containerName: 'LLMContainer',
      cpu: 1024
    })
    
    container.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP,
      name: 'app-80-tcp',
      appProtocol: ecs.AppProtocol.http
    })

    this.llmService = new ecs.FargateService(this, 'LLMFargateService', { 
      cluster: cluster,
      taskDefinition: taskDefinition,
      assignPublicIp: false,
      securityGroups: [sg],
      serviceName: 'LLMFargateService',
    })    

    const lb = new elbv2.ApplicationLoadBalancer(this, 'PennyALB', {
      vpc: vpc,
      internetFacing: true,
    })
  
    const httpListener = lb.addListener('PennyHttpListener', {
      port: 80,
      open: true,
    })
  
    httpListener.addTargets('PennyECS', {
      port: 80,
      targets: [this.llmService],
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(60),
      },
    })

    const corsHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'CorsHeadersPolicy', {
      responseHeadersPolicyName: 'CorsHeadersPolicy',
      corsBehavior: {
        accessControlAllowOrigins: ['*'],
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
        accessControlAllowHeaders: ['*'],
        accessControlAllowCredentials: false,
        originOverride: true,
      },
    });
  
    const distribution = new cloudfront.Distribution(this, 'PennyDistribution', {
      defaultBehavior: {
        origin: new origins.HttpOrigin(lb.loadBalancerDnsName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        responseHeadersPolicy: corsHeadersPolicy,
      },
    });
  
    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: distribution.distributionDomainName,
    });

  }
}