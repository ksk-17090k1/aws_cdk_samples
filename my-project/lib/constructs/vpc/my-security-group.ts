import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

/*
ALB２台構成の、セキュリティグループの構成をFE~BEまでまとめたもの
*/

// NOTE: CAILのCDKで、RDSの宣言をclassでラップして、そのクラスのメソッドにallowFrom(IConnectable)というのを作るのがキレイな設計だと思った。

type Props = {
  vpc: ec2.IVpc;
};

export class MySecurityGroup extends Construct {
  readonly sgIngress: ec2.ISecurityGroup;
  readonly sgFrontContainer: ec2.ISecurityGroup;
  readonly sgInternal: ec2.ISecurityGroup;
  readonly sgContainer: ec2.ISecurityGroup;
  readonly sgDb: ec2.ISecurityGroup;
  readonly sgEgress: ec2.ISecurityGroup;
  readonly sgManagement: ec2.ISecurityGroup;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = props.vpc;

    // FEのpublicなALB用
    const sgIngress = new ec2.SecurityGroup(this, "MySgIngress", {
      vpc,
      allowAllOutbound: true,
      description: "Security group for ingress",
    });
    // FEのアプリケーション用 (private subnet)
    const sgFrontContainer = new ec2.SecurityGroup(this, "MySgFrontContainer", {
      vpc,
      allowAllOutbound: false,
      description: "Security Group of front container app",
    });
    // FEとBEをつなぐinternalなALB用
    const sgInternal = new ec2.SecurityGroup(this, "MySgInternal", {
      vpc,
      allowAllOutbound: true,
      description: "Security group for internal load balancer",
    });
    // BEのアプリケーション用
    const sgContainer = new ec2.SecurityGroup(this, "MySgContainer", {
      vpc,
      allowAllOutbound: true,
      description: "Security Group of backend app",
    });
    // DB用
    const sgDb = new ec2.SecurityGroup(this, "MySgDb", {
      vpc,
      allowAllOutbound: true,
      description: "Security Group of database",
    });
    // VPC Endpoint用 (NATで代用しても良い)
    const sgEgress = new ec2.SecurityGroup(this, "MySgEgress", {
      vpc,
      allowAllOutbound: false,
      description: "Security Group of VPC Endpoint",
    });
    // bastion用
    const sgManagement = new ec2.SecurityGroup(this, "MySgManagement", {
      vpc,
      allowAllOutbound: true,
      description: "Security Group of management server",
    });

    // NOTE: ec2.Peer.ipv4(vpc.vpcCidrBlock), と書くとVPC内の通信のみを許可する設定が書ける

    // FEのALBはHTTPのみを許可
    sgIngress.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP from anywhere"
    );
    sgIngress.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(80),
      "Allow HTTP from anywhere"
    );

    // allowFromを使うとアウトバウンドのルールも自動で追加される
    // ただし allowAllOutbound をfalseにしておく必要がある
    // ref: https://qiita.com/akwayne/items/5af3c99e4e9786040598

    // NOTE: ec2.Port.allTraffic() と書くと全てのポートが許可される

    // --- FEからBEまでの接続 ---
    // ingress -> frontContainer -> internal -> backendContainer
    sgFrontContainer.connections.allowFrom(
      sgIngress,
      ec2.Port.tcp(80),
      "HTTP from Ingress"
    );
    sgFrontContainer.connections.allowFrom(
      sgIngress,
      ec2.Port.tcp(443),
      "HTTPS from Ingress"
    );

    sgInternal.connections.allowFrom(
      sgFrontContainer,
      ec2.Port.tcp(80),
      "HTTP from front container"
    );
    sgInternal.connections.allowFrom(
      sgFrontContainer,
      ec2.Port.tcp(443),
      "HTTPS from front container"
    );

    sgContainer.connections.allowFrom(
      sgInternal,
      ec2.Port.tcp(80),
      "HTTP from internal LB"
    );
    sgContainer.connections.allowFrom(
      sgInternal,
      ec2.Port.tcp(443),
      "HTTPS from internal LB"
    );

    // --- DBへの接続 ---
    // backendContainer -> db
    // frontContainer -> db
    sgDb.connections.allowFrom(
      sgContainer,
      ec2.Port.tcp(3306),
      "MySQL from backend App"
    );
    sgDb.connections.allowFrom(
      sgFrontContainer,
      ec2.Port.tcp(3306),
      "MySQL from frontend App"
    );

    // --- egressへの接続 ---
    // container -> egress
    // frontContainer -> egress
    sgEgress.connections.allowFrom(
      sgContainer,
      ec2.Port.tcp(443),
      "HTTPS from Container App"
    );
    sgEgress.connections.allowFrom(
      sgFrontContainer,
      ec2.Port.tcp(443),
      "HTTPS from Front Container App"
    );

    // --- 管理用サーバからの接続 ---
    // management -> internal
    // management -> db
    // management -> egress
    sgInternal.connections.allowFrom(
      sgManagement,
      ec2.Port.tcp(80),
      "HTTP from management server"
    );
    sgDb.connections.allowFrom(
      sgManagement,
      ec2.Port.tcp(3306),
      "MySQL from management server"
    );
    sgEgress.connections.allowFrom(
      sgManagement,
      ec2.Port.tcp(443),
      "HTTPS from management server"
    );

    this.sgIngress = sgIngress;
    this.sgFrontContainer = sgFrontContainer;
    this.sgInternal = sgInternal;
    this.sgContainer = sgContainer;
    this.sgDb = sgDb;
    this.sgEgress = sgEgress;
    this.sgManagement = sgManagement;
  }
}
