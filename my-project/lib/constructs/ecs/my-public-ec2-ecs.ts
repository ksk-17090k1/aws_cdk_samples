import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";

// NOTE: デプロイまだしたことないです

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

    const cluster = new ecs.Cluster(this, `Cluster${stackVersion}`, {
      clusterName: `my-public-cluster${stackVersion}`,
      vpc,
      //   enableFargateCapacityProviders: true,
      containerInsights: false,
    });

    // TODO: ちゃんと理解してない
    // ただECS on EC2の場合は必須ぽい。
    cluster.addCapacity("DefaultAutoScalingGroupCapacity", {
      instanceType: new ec2.InstanceType("t2.xlarge"),
      desiredCapacity: 3,
    });

    // AWSマネジメントコンソールから作成した場合に自動で付与される権限をつける
    // refs: https://dev.classmethod.jp/articles/ecs-exec-enableexecutecommand-error/
    const executionRole = new iam.Role(this, "PromptfooExecRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["*"],
      })
    );

    const Ec2TaskDefinition = new ecs.Ec2TaskDefinition(
      this,
      "PromptfooTaskDef",
      {
        family: `MyEc2TaskDef`,
        // デフォルトは EC2なら NetworkMode.BRIDGE, Fargateなら NetworkMode.AWS_VPC
        // 推奨はAWS_VPCなので変更する
        networkMode: ecs.NetworkMode.AWS_VPC,
        executionRole: executionRole,
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

    Ec2TaskDefinition.addContainer("main", {
      image: ecs.ContainerImage.fromAsset("./lib/constructs/ecs/", {
        platform: Platform.LINUX_AMD64,
      }),
      portMappings: [
        { containerPort: 3000, hostPort: 3000, protocol: ecs.Protocol.TCP },
      ],
      cpu: 512,
      memoryLimitMiB: 1024,
      memoryReservationMiB: 1024,
      interactive: false,
      pseudoTerminal: false,
      readonlyRootFilesystem: false,
      environment: {
        PROMPTFOO_REMOTE_API_BASE_URL: "http://localhost:3000",
      },
      logging: logDriver,
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

    const service = new ecs.Ec2Service(this, "MyEc2Service", {
      serviceName: "MyEc2Service",
      cluster,
      taskDefinition: Ec2TaskDefinition,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [sgService],
      // TODO: EC2の場合の capacityProviderStrategies はけっこう複雑そう
      // refs: https://dev.classmethod.jp/articles/regrwoth-capacity-provider/
      desiredCount: 1,
      assignPublicIp: true,
      deploymentController: {
        type: ecs.DeploymentControllerType.ECS,
      },
      circuitBreaker: {
        rollback: false,
      },
      enableExecuteCommand: true,
    });

    this.fargateService = service;
  }
}
