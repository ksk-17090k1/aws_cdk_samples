// TODO: 以下をみて実装
// https://qiita.com/suzuki_ryota/items/fbfaa12551e5fb186c0f

// NOTE: 以下は上記の記事をただコピペしているだけなので要修正
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

import {
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_logs as logs,
  aws_elasticloadbalancingv2 as elbv2,
} from "aws-cdk-lib";

const APP_FOLDER = path.join(__dirname, "../resources/scalable-ecs-app");
const NAME = "scalable-ecs";

export class ScalableEcsOnCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = this.createVpc();

    const [cluster, service] = this.createEcs(vpc);

    const alb = this.createAlb(vpc, service);
  }

  createVpc() {
    return new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      vpcName: `${NAME}-vpc`,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "application",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });
  }

  createEcs(vpc: ec2.Vpc): [ecs.Cluster, ecs.FargateService] {
    const logDriver = new ecs.AwsLogDriver({
      streamPrefix: `${NAME}-ecs`,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const fargateTaskDefinition = new ecs.FargateTaskDefinition(this, "Task", {
      cpu: 256,
      memoryLimitMiB: 1024,
    });

    const container = fargateTaskDefinition.addContainer("Container", {
      image: ecs.ContainerImage.fromAsset(APP_FOLDER),
      portMappings: [{ containerPort: 80, hostPort: 80 }],
      logging: logDriver,
      stopTimeout: cdk.Duration.seconds(60), // 停止シグナル送信から強制終了までの待ち時間
    });

    const cluster = new ecs.Cluster(this, "EcsCluster", {
      vpc: vpc,
    });

    const service = new ecs.FargateService(this, "Service", {
      cluster: cluster,
      taskDefinition: fargateTaskDefinition,
      //desiredCount: 1, // タスクの数
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // スケーリング設定
    const scaling = service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 8,
    });
    scaling.scaleOnCpuUtilization("cpuScaling", {
      targetUtilizationPercent: 20,
    });

    return [cluster, service];
  }

  createAlb(vpc: ec2.IVpc, ecsService: ecs.FargateService) {
    // ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc: vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      internetFacing: true,
    });

    // リスナー
    const listener = alb.addListener("Listener", {
      port: 80,
      defaultAction: elbv2.ListenerAction.fixedResponse(404),
    });

    // ターゲット
    listener.addTargets("target", {
      port: 80,
      targets: [ecsService],
      priority: 1,
      conditions: [elbv2.ListenerCondition.httpRequestMethods(["GET"])],
      healthCheck: {
        path: "/sleep/1",
        port: "80",
        // 検証のためにヘルスチェックがNGにならないように長めに設定
        interval: cdk.Duration.seconds(300),
        unhealthyThresholdCount: 10,
      },
    });

    return alb;
  }
}
