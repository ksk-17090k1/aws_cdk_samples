import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";

// TODO: SSMセッションマネージャーを使ってprivate subnetのEC2に接続する場合は、
//       NATもしくはVPCエンドポイントの設定が必要。なのでVPCエンドポイント版を作成したい。

// TODO: IMDSv2を有効にしろとまねこんに表示されていた。

type Props = {};

export class MySSMPublicEc2 extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // 適宜必要なポリシーをつける
    const role = new iam.Role(this, "MyEc2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [],
      description: "my-ec2-instance-role",
    });

    const vpc = ec2.Vpc.fromLookup(this, "VPC", {
      vpcId: "vpc-0639495a2c0c878ec",
      region: "ap-northeast-1",
    });

    // セキュリティグループは指定しないとインバウンドルールが一切ないセキュリティグループが作成される
    // アウトバウンドはすべてが許可される
    const securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      securityGroupName: "MySecurityGroup",
      allowAllOutbound: true,
    });
    // SSMでの接続では、SSMのクライアントがポート443でEC2インスタンスと通信するため443ポート開放は必要!
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS Access"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow ICMP Access"
    );

    // SSH over SSMするにはkeypairが必要
    const keyPair = new ec2.KeyPair(this, "KeyPair", {
      keyPairName: "MyKeyPair",
      type: ec2.KeyPairType.RSA,
      format: ec2.KeyPairFormat.PEM,
    });

    new ec2.Instance(this, "MyInstance", {
      instanceName: "MyInstance",
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
      instanceType: ec2.InstanceType.of(
        // ARMならT4g, x84ならT2がいいかも
        ec2.InstanceClass.T2,
        ec2.InstanceSize.NANO
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      securityGroup: securityGroup,
      associatePublicIpAddress: true,
      role: role,
      keyPair: keyPair,
      // SSMセッションマネージャからログインする場合に必要
      // 具体的には、EC2に付与するIAMロールにAmazonSSMManagedInstanceCoreをアタッチする効果
      ssmSessionPermissions: true,
      detailedMonitoring: false,
    });
  }
}
