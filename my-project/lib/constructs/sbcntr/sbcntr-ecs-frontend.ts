import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";

type Props = {
  vpc: ec2.IVpc;
  backendHost: string;
  sgService: ec2.ISecurityGroup;
};

export class SbcntrEcsFrontend extends Construct {
  readonly fargateService: ecs.FargateService;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = props.vpc;

    // ECS Cluster
    const cluster = new ecs.Cluster(this, "EcsFrontendCluster", {
      clusterName: `sbcntr-frontend-cluster`,
      vpc: vpc,
    });

    // Log Group
    const logGroup = new logs.LogGroup(this, "LogGroupFrontend", {
      logGroupName: `/ecs/sbcntr-frontend-log-group`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: iam.Role.fromRoleArn(
        this,
        "ExecutionRole",
        `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/ecsTaskExecutionRole`
      ),
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
      },
    });

    const container = taskDefinition.addContainer("web", {
      image: ecs.ContainerImage.fromRegistry(
        `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/sbcntr-frontend:v1`
      ),
      logging: ecs.LogDriver.awsLogs({
        logGroup: logGroup,
        streamPrefix: "ecs",
      }),
      environment: {
        // SESSION_SECRET_KEY: "41b678c65b37bf99c37bcab522802760",
        APP_SERVICE_HOST: `http://${props.backendHost}`,
        NOTIF_SERVICE_HOST: `http://${props.backendHost}`,
      },
    });

    container.addPortMappings({
      containerPort: 80,
      hostPort: 80,
      protocol: ecs.Protocol.TCP,
    });

    // subnet idの取得
    const { subnetIds: ecsSubnetIds } = vpc.selectSubnets({
      subnetGroupName: "sbcntr-subnet-private-container",
    });

    const service = new ecs.FargateService(this, "Service", {
      serviceName: "sbcntr-frontend-service",
      cluster,
      taskDefinition: taskDefinition,
      platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
      vpcSubnets: {
        subnets: [
          ec2.Subnet.fromSubnetId(this, "ECSBackendSubnet1", ecsSubnetIds[0]),
          ec2.Subnet.fromSubnetId(this, "ECSBackendSubnet2", ecsSubnetIds[1]),
        ],
      },
      securityGroups: [props.sgService],
      capacityProviderStrategies: [
        {
          capacityProvider: "FARGATE_SPOT",
          base: 0,
          weight: 1,
        },
        {
          capacityProvider: "FARGATE",
          base: 1,
          weight: 1,
        },
      ],
      desiredCount: 1,
      healthCheckGracePeriod: cdk.Duration.seconds(120),
      deploymentController: {
        type: ecs.DeploymentControllerType.ECS,
      },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    this.fargateService = service;
  }
}
