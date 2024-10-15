import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";

type Props = {};

export class MyCustomEc2 extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // 適宜必要なポリシーをつける
    const role = new iam.Role(this, "MyEc2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        // SSMセッションマネージャで接続するためのポリシー
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
      description: "my-ec2-instance-role",
    });

    // // デフォルトで用意されているVPCを選択
    // const vpc = ec2.Vpc.fromLookup(this, "VPC", {
    //     isDefault: true,
    //   });

    const vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.100.0.0/16"),
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "ingress",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    // キーペアは明示的に作成しないとデフォルトでは作成されない
    const keyPair = new ec2.KeyPair(this, "KeyPair", {
      keyPairName: "MyKeyPair",
      type: ec2.KeyPairType.RSA,
      format: ec2.KeyPairFormat.PEM,
    });

    // セキュリティグループは指定しないとインバウンドルールが一切ないセキュリティグループが作成される
    // アウトバウンドはすべてが許可される
    const securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      securityGroupName: "MySecurityGroup",
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(
      // anyIpv4は 0.0.0.0/0 と同じ
      // SSHに関してはセキュリティ観点で必要最低限のIPに絞ったほうが良い。
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH Access"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP Access"
    );
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

    // ====== AMI (Amazon Machine Image) ======
    // --- Linux ---
    // All arguments shown are optional and will default to these values when omitted.
    const amznLinux2 = ec2.MachineImage.latestAmazonLinux2({
      edition: ec2.AmazonLinuxEdition.STANDARD,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    });
    const amznLinux2023 = ec2.MachineImage.latestAmazonLinux2023();
    // For other custom (Linux) images, instantiate a `GenericLinuxImage` with
    // a map giving the AMI to in for each region:
    const linux = ec2.MachineImage.genericLinux({
      "ap-northeast-1": "ami-0091f05e4b8ee6709",
      "us-east-1": "ami-97785bed",
      // ...
    });

    // --- Windows ---
    const windows = ec2.MachineImage.latestWindows(
      ec2.WindowsVersion.WINDOWS_SERVER_2022_JAPANESE_FULL_BASE
    );
    // For other custom (Windows) images, instantiate a `GenericWindowsImage` with
    // a map giving the AMI to in for each region:
    const genericWindows = ec2.MachineImage.genericWindows({
      "ap-northeast-1": "ami-0987eed561fe06332",
      "us-east-1": "ami-97785bed",
      // ...
    });

    // --- Other ways ---
    // Read AMI id from SSM parameter store
    const ssm = ec2.MachineImage.fromSsmParameter("/my/ami", {
      os: ec2.OperatingSystemType.LINUX,
    });
    // Look up the most recent image matching a set of AMI filters.
    // In this case, look up the NAT instance AMI, by using a wildcard
    // in the 'name' field:
    const natAmi = ec2.MachineImage.lookup({
      name: "amzn-ami-vpc-nat-*",
      owners: ["amazon"],
    });

    new ec2.Instance(this, "MyInstance", {
      instanceName: "MyInstance",
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
      instanceType: ec2.InstanceType.of(
        // ARMならT4g, x84ならT2がいいかも
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.NANO
      ),
      machineImage: amznLinux2,
      securityGroup: securityGroup,
      // パブリックIPの付与。EC2をパブリックサブネットに置くけどEIPは使用しないときにtrue
      associatePublicIpAddress: true,
      role: role,
      keyPair: keyPair,
      // SSMセッションマネージャからログインする場合に必要
      ssmSessionPermissions: true,
      // デフォルトで５分おきに取得するメトリクスを1分ごとにする。コストが増えるので注意。
      detailedMonitoring: false,
    });
  }
}
