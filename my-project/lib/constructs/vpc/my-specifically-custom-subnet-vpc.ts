import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Tags } from "aws-cdk-lib";

type Props = {};

export class MySpecificallyCustomSubnetVpc extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, "MyVpc", {
      ipAddresses: ec2.IpAddresses.cidr("192.168.0.0/16"),
      // NOTE: ここを空のリストにするとサブネットやIGW, NAT Gatewayなどが作成されない
      subnetConfiguration: [],
    });

    // --- Public Subnet ---
    const subnetPub = new ec2.Subnet(this, "SubnetPub", {
      availabilityZone: "ap-northeast-1a",
      vpcId: vpc.vpcId,
      cidrBlock: "192.168.0.0/24",
    });
    Tags.of(subnetPub).add("Name", "my-subnet-public");

    // --- Internet Gateway ---
    const igw = new ec2.CfnInternetGateway(this, "IGW", {
      tags: [
        {
          key: "Name",
          value: "my-igw",
        },
      ],
    });
    // internet gatewayとVPCを紐づけ
    new ec2.CfnVPCGatewayAttachment(this, "IGWAttach", {
      vpcId: vpc.vpcId,
      internetGatewayId: igw.ref,
    });

    // --- route table ---
    const publicTable = new ec2.CfnRouteTable(this, "PublicRouteTable", {
      vpcId: vpc.vpcId,
      tags: [{ key: "Name", value: "my-public-route-table" }],
    });
    // route tableの設定
    new ec2.CfnRoute(this, "PublicRoute", {
      routeTableId: publicTable.ref,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: igw.ref,
    });
    // route tableとsubnetを紐づけ
    new ec2.CfnSubnetRouteTableAssociation(this, "PublicAss", {
      subnetId: subnetPub.subnetId,
      routeTableId: publicTable.ref,
    });

    // TODO: NATとPrivate Subnetの同様の設定
  }
}
