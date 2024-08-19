import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";

type Props = {
  vpc: ec2.IVpc;
  sgContainer: ec2.ISecurityGroup;
};

export class MyPrivateEcs extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const stackVersion = this.node.tryGetContext("stackVersion");
    const vpc = props.vpc;

    const cluster = new ecs.Cluster(this, `Cluster${stackVersion}`, {
      clusterName: `my-private-cluster${stackVersion}`,
      vpc,
      enableFargateCapacityProviders: true,
    });

    const executionRole = new iam.Role(this, "MyEcsExeRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
      description: "my-ecs-execution-role",
    });
    // SSM Messages のフルアクセスを追加
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel",
        ],
        resources: ["*"],
      })
    );
    const fargateTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDef",
      {
        cpu: 256,
        memoryLimitMiB: 512,
        executionRole: executionRole,
      }
    );

    const logDriver = new ecs.AwsLogDriver({
      streamPrefix: "my-ecs",
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    fargateTaskDefinition.addContainer("web", {
      image: ecs.ContainerImage.fromAsset("./lib/constructs/ecs/", {
        platform: Platform.LINUX_AMD64,
      }),
      logging: logDriver,
    });

    // subnet idの取得
    const { subnetIds: albSubnetIds } = vpc.selectSubnets({
      subnetGroupName: "sbcntr-subnet-private-container",
    });

    const service = new ecs.FargateService(this, "Service", {
      serviceName: "my-private-service",
      cluster,
      taskDefinition: fargateTaskDefinition,
      vpcSubnets: {
        subnets: [
          ec2.Subnet.fromSubnetId(this, "ECSSubnet1", albSubnetIds[0]),
          ec2.Subnet.fromSubnetId(this, "ECSSubnet2", albSubnetIds[1]),
        ],
      },
      securityGroups: [props.sgContainer],
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
    });
  }
}
