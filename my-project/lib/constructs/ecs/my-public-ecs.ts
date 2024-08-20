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
      enableFargateCapacityProviders: true,
      // ログが詳細に出る設定
      containerInsights: false,
    });

    // TODO:
    // Add capacity to it
    // cluster.addCapacity("DefaultAutoScalingGroupCapacity", {
    //   instanceType: new ec2.InstanceType("t2.xlarge"),
    //   desiredCapacity: 3,
    // });

    // TODO:
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

    const dummyRoll = new iam.Role(this, "MyDummyRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"),
      ],
    });

    // Fargate Service
    const fargateTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "TaskDef",
      {
        family: `my-public-taskdef${stackVersion}`,
        cpu: 256,
        memoryLimitMiB: 512,
        // cpu, memoryと相性があるので以下確認すること
        // ref: operatingSystemFamily: ecs.OperatingSystemFamily.WINDOWS_SERVER_2019_CORE,
        runtimePlatform: {
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
          // ARMにするとfargate spotが使えないので注意
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
        },
        // コンテナを立ち上げるときにECSが使うロール
        // 実態としては、ECRからのイメージのpullとCloudWatch Logsへの書き込みを行う権限
        // 指定しなければ勝手にCDKが作ってくれるので指定しないべき。
        // executionRole: dummyRoll,
        // コンテナに付与されるロール
        taskRole: dummyRoll,
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
        // この設定は docker build --platform linux/amd64 に相当。
        // NOTE: Dockerfileの方のFROMのところに --platform=linux/amd64AMD を指定するやり方のがいいかも。
        platform: Platform.LINUX_AMD64,
      }),
      // 通信がawsvpcかhost network modeを使用している場合は、hostportはコンテナポートと同じ値か、指定を省略できる。
      portMappings: [
        { containerPort: 3000, hostPort: 3000, protocol: ecs.Protocol.TCP },
      ],
      // docker container run するときの -i オプション
      interactive: false,
      // docker container run するときの -t オプション (ttyの確保)
      pseudoTerminal: false,
      // trueにするとセキュリティが上がるらしい
      readonlyRootFilesystem: false,
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
    // (あと地味にタスクには複数コンテナ追加できることを覚えておく。)
    // fargateTaskDefinition.addContainer("web-from-resistory", {
    //   // AWSが用意しているサンプルイメージ (TODO: なぜかエラーがでるので調査)
    //   // NOTE: ECRのpublic repositoryはVPCエンドポイントでは接続できないらしいので注意！
    //   //   image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
    //   // ECRの命名規則に従ったイメージ名 (TODO: なぜかエラーがでるので調査)
    //   image: ecs.ContainerImage.fromRegistry(
    //     `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/sbcntr-backend:v1`
    //   ),
    //   logging: logDriver,
    //   portMappings: [
    //     { containerPort: 80, hostPort: 80, protocol: ecs.Protocol.TCP },
    //   ],
    // });

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
      // 基本LATESTで良いと思われる
      platformVersion: ecs.FargatePlatformVersion.LATEST,
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
      // ALBのヘルスチェックを無視する時間 (ALBが無い場合は指定するとエラー)
      // デフォルトの60秒は短いらしいので120秒にしている
      healthCheckGracePeriod: cdk.Duration.seconds(120),
      // deploy戦略 (ECS: rolling updates, CODE_DEPLOY: blue/green)
      deploymentController: {
        type: ecs.DeploymentControllerType.ECS,
      },
      // 以下２つはEC2でローリングデプロイをする場合のパラメータ
      // Fargetやblue/greenデプロイの場合は無視される
      // 厳密にいうと、blue/greenデプロイの場合は最小が100で最大が200になる
      //  ref: https://zenn.dev/kenryo/articles/ecs-min-max-helth-percentage
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    this.fargateService = service;
  }
}
