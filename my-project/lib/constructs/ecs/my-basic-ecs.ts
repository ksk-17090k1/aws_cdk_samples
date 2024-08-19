import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";

type Props = {
  vpc: ec2.IVpc;
  sgContainer: ec2.ISecurityGroup;
};

export class MyBasicEcs extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // const vpc = props.vpc;

    const vpc = new ec2.Vpc(this, "MyVpc", {
      vpcName: "MyEcsVpc",
      // 192.168.0.0/16, 172.16.0.0/16 でもOK
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      // it defaults to 3
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "ingress",
          // internet gatewayがアタッチされたサブネット
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: `my-basic-cluster`,
      vpc,
      enableFargateCapacityProviders: true,
    });

    // Add capacity to it
    // cluster.addCapacity("DefaultAutoScalingGroupCapacity", {
    //   instanceType: new ec2.InstanceType("t2.xlarge"),
    //   desiredCapacity: 3,
    // });

    // ECS Service
    // const ec2TaskDefinition = new ecs.Ec2TaskDefinition(this, "TaskDef");
    // ec2TaskDefinition.addContainer("DefaultContainer", {
    //   image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
    //   memoryLimitMiB: 512,
    // });
    // const ecsService = new ecs.Ec2Service(this, "Service", {
    //   cluster,
    //   taskDefinition: ec2TaskDefinition,
    // });

    // Fargate Service
    const fargateTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDef",
      {
        cpu: 256,
        memoryLimitMiB: 512,
        // AmazonECSTaskExecutionRolePolicy がアタッチされたIAMロールを指定する
        // 勝手に作成されることがあるらしいが、無い場合は別途作成が必要。
        executionRole: iam.Role.fromRoleArn(
          this,
          "ExecutionRole",
          `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/ecsTaskExecutionRole`
        ),
      }
    );

    const logDriver = new ecs.AwsLogDriver({
      streamPrefix: "my-ecs",
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    fargateTaskDefinition.addContainer("web", {
      // NOTE: ヘルスチェックはここでも入れられるが、ALBで入れてるので指定しない
      //   image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      // ECRの命名規則に従ったイメージ名
      //   image: ecs.ContainerImage.fromRegistry(
      //     `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/sbcntr-frontend:v1`
      //   ),
      // 以下のようにすると、指定したディレクトリ配下のDockerfileを使える
      // NOTE: 内部の挙動としてはECRにpushされるので、結果private subnetならNATかVPCエンドポイントが必要
      image: ecs.ContainerImage.fromAsset("./lib/constructs/ecs/"),
      //   memoryLimitMiB: 512,
      // 通信がawsvpcかhost network modeを使用している場合は、hostportはコンテナポートと同じ値か、指定を省略できる。
      //   portMappings: [{ containerPort: 3000, hostPort: 3000 }],
      // docker container run するときの -i オプション
      //   interactive: true,
      environment: {
        STAGE: "prod",
      },
      logging: logDriver,
      // 以下はFargateの場合は必須ではない
      cpu: 256,
      // memoryのhard limit
      memoryLimitMiB: 512,
      // memoryのsoft limit
      memoryReservationMiB: 512,
    });

    // subnet idの取得
    // const { subnetIds: albSubnetIds } = vpc.selectSubnets({
    //   subnetGroupName: "sbcntr-subnet-private-container",
    // });

    const service = new ecs.FargateService(this, "Service", {
      serviceName: "my-basic-service",
      cluster,
      taskDefinition: fargateTaskDefinition,
      // TODO: subnetを指定する方法をまとめたい。
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      // とかでもできる。あとたぶんsubnetIdでもできる。
      //   vpcSubnets: {
      //     subnets: [
      //       ec2.Subnet.fromSubnetId(this, "ECSSubnet1", albSubnetIds[0]),
      //       ec2.Subnet.fromSubnetId(this, "ECSSubnet2", albSubnetIds[1]),
      //     ],
      //   },
      //   securityGroups: [props.sgContainer],
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
      // default is 1
      desiredCount: 2,
      // 以下２つはEC2でローリングデプロイをする場合のパラメータ
      // Fargetやblue/greenデプロイの場合は無視される
      // 厳密にいうと、blue/greenデプロイの場合は最小が100で最大が200になる
      //  ref: https://zenn.dev/kenryo/articles/ecs-min-max-helth-percentage
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      //   assignPublicIp: true,
    });

    // これでターゲットグループにサービスをアタッチできるぽい
    // service.attachToApplicationTargetGroup(targetGroup);

    // これでもいける？
    // const albTargetGroup = alb.ApplicationTargetGroup.fromTargetGroupAttributes(
    //   this,
    //   "AlbTargetGroup",
    //   {
    //     targetGroupArn: tryGetStageContext(this.node, "targetGroupArn"),
    //   }
    // );

    // albTargetGroup.addTarget(
    //   serviceFargateService.loadBalancerTarget({
    //     containerName: serviceTaskDefinition.defaultContainer!.containerName,
    //     containerPort: serviceTaskDefinition.defaultContainer!.containerPort,
    //   })
    // );
  }
}
