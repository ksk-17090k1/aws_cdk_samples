import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";

type Props = {};

export class MyPublicEcs extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const stackVersion = this.node.tryGetContext("stackVersion");
    const vpc = new ec2.Vpc(this, `MyVpc${stackVersion}`, {
      vpcName: "MyEcsVpc${stackVersion}",
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

    // コンテナを立ち上げるときにECSが使うロール
    // 同じ内容の AmazonECSTaskExecutionRolePolicy というロールが勝手に作成されることがあるらしいが、
    // CDKで明示的に指定したい場合や、何かしらの理由で無い場合は下記のように作成が必要。
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

    // Fargate Service
    const fargateTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDef",
      {
        cpu: 256,
        memoryLimitMiB: 512,
        executionRole: executionRole,
        // コンテナに付与されるロール
        // executionRole と同一である必要はまったくないが、ダミーとして設定
        taskRole: executionRole,
      }
    );

    const logDriver = new ecs.AwsLogDriver({
      streamPrefix: "my-ecs",
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // ローカルのDockerfileを使ってイメージをビルドする場合
    // TODO: なんかちゃんとイメージタグとかを管理するやりかたがあるらしい
    // NOTE: ヘルスチェックは以下のところでも入れられるが、ALBで入れてるので指定しない
    fargateTaskDefinition.addContainer("web", {
      // 以下のようにすると、指定したディレクトリ配下のDockerfileを使える
      // NOTE: 内部の挙動としてはECRにpushされるので、結果private subnetならNATかVPCエンドポイントが必要
      image: ecs.ContainerImage.fromAsset("./lib/constructs/ecs/", {
        // M1 MacでAMDのFarget用のイメージをビルドしたいときは以下を指定
        // NOTE: Dockerfileの方のFROMのところでAMDを指定するやり方のがいいかも。
        platform: Platform.LINUX_AMD64,
      }),
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

    // ECRからイメージを取得する場合
    fargateTaskDefinition.addContainer("web-from-resistory", {
      // NOTE: ECRのpublic repositoryはVPCエンドポイントでは接続できないらしいので注意！
      image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      // ECRの命名規則に従ったイメージ名
      //   image: ecs.ContainerImage.fromRegistry(
      //     `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/sbcntr-frontend:v1`
      //   ),
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
      serviceName: "my-basic-service",
      cluster,
      taskDefinition: fargateTaskDefinition,
      // TODO: subnetを指定する方法をまとめたい。3種類あるはず。種類、ID、IDで検索
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
      // default is 1
      desiredCount: 2,
      // public subnetにコンテナ立てる場合はtrueにしないとECRへ接続できない！
      assignPublicIp: true,
      // 以下２つはEC2でローリングデプロイをする場合のパラメータ
      // Fargetやblue/greenデプロイの場合は無視される
      // 厳密にいうと、blue/greenデプロイの場合は最小が100で最大が200になる
      //  ref: https://zenn.dev/kenryo/articles/ecs-min-max-helth-percentage
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
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
