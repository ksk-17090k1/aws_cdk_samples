import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as efs from "aws-cdk-lib/aws-efs";

type Props = {};

export class MyPublicEcs extends Construct {
  readonly fargateService: ecs.FargateService;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const stackVersion = this.node.tryGetContext("stackVersion");
    const vpc = new ec2.Vpc(this, `MyVpc${stackVersion}`, {
      vpcName: `MyEcsVpc${stackVersion}`,
      ipAddresses: ec2.IpAddresses.cidr("10.8.0.0/16"),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const sgService = new ec2.SecurityGroup(this, "service-sg", {
      vpc,
      allowAllOutbound: true,
      description: "Security Group of ECS Service",
    });
    sgService.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS from anywhere"
    );
    const sgEfs = new ec2.SecurityGroup(this, "efs-sg", {
      vpc,
      allowAllOutbound: true,
      description: "Security Group of Promptfoo EFS",
    });

    // EFS - ECS Service間の通信を許可
    sgEfs.connections.allowFrom(
      sgService,
      // EFSは2049番ポートを使用する
      ec2.Port.tcp(2049),
      "Access from EFS"
    );

    const fileSystem = new efs.FileSystem(this, "PromptfooEfsFileSystem", {
      vpc: vpc,
      // private subnetへの配置が推奨
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      securityGroup: sgEfs,
      encrypted: true,
      // 一定期間アクセスされなかったファイルをInfrequent Access (IA) storageへ移動する
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // コストを抑える観点では以下2つは以下の設定で良い
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
    });
    // マウントターゲット経由でのみEFSへのアクセスを許可
    fileSystem.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["elasticfilesystem:ClientMount"],
        principals: [new iam.AnyPrincipal()],
        conditions: {
          Bool: {
            "elasticfilesystem:AccessedViaMountTarget": "true",
          },
        },
      })
    );

    const cluster = new ecs.Cluster(this, `Cluster${stackVersion}`, {
      clusterName: `my-public-cluster${stackVersion}`,
      vpc,
      enableFargateCapacityProviders: true,
      containerInsights: false,
    });

    const fargateTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDef",
      {
        family: `my-public-taskdef${stackVersion}`,
        cpu: 256,
        memoryLimitMiB: 512,
        runtimePlatform: {
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
        },
        volumes: [
          {
            name: "promptfoo-efs",
            efsVolumeConfiguration: {
              fileSystemId: fileSystem.fileSystemId,
              // デフォルトは"/" (root)
              // rootDirectory: '/models',
            },
          },
        ],
      }
    );

    // log setting
    const logGroup = new logs.LogGroup(this, "LogGroupBackend", {
      logGroupName: `/ecs/sbcntr-backend-log-group`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const logDriver = new ecs.AwsLogDriver({
      streamPrefix: "my-ecs",
      logGroup: logGroup,
    });

    fargateTaskDefinition.addContainer("web", {
      image: ecs.ContainerImage.fromAsset("./lib/constructs/ecs/", {
        platform: Platform.LINUX_AMD64,
      }),
      portMappings: [
        { containerPort: 3000, hostPort: 3000, protocol: ecs.Protocol.TCP },
      ],
      environment: {
        STAGE: "prod",
      },
      logging: logDriver,
    });

    const service = new ecs.FargateService(this, "Service", {
      serviceName: "my-basic-service",
      cluster,
      taskDefinition: fargateTaskDefinition,
      platformVersion: ecs.FargatePlatformVersion.LATEST,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [sgService],
      capacityProviderStrategies: [
        {
          capacityProvider: "FARGATE_SPOT",
          base: 2,
          weight: 1,
        },
        {
          capacityProvider: "FARGATE",
          base: 0,
          weight: 0,
        },
      ],
      desiredCount: 2,
      assignPublicIp: true,
      deploymentController: {
        type: ecs.DeploymentControllerType.ECS,
      },
      circuitBreaker: {
        rollback: false,
      },
    });

    this.fargateService = service;
  }
}
