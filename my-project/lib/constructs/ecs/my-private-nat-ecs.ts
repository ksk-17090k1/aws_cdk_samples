import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";

type Props = {};

export class MyPrivateNatEcs extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const stackVersion = this.node.tryGetContext("stackVersion");
    const vpc = new ec2.Vpc(this, `MyVpc${stackVersion}`, {
      vpcName: "MyEcsVpc${stackVersion}",
      ipAddresses: ec2.IpAddresses.cidr("10.16.0.0/16"),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const cluster = new ecs.Cluster(this, `Cluster${stackVersion}`, {
      clusterName: `my-private-nat-cluster${stackVersion}`,
      vpc,
      enableFargateCapacityProviders: true,
    });

    const fargateTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDef",
      {
        family: "my-private-nat-task",
        cpu: 256,
        memoryLimitMiB: 512,
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
      portMappings: [
        { containerPort: 3000, hostPort: 3000, protocol: ecs.Protocol.TCP },
      ],
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
    const service = new ecs.FargateService(this, "Service", {
      serviceName: "my-private-nat-service",
      cluster,
      taskDefinition: fargateTaskDefinition,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
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
    });
  }
}
