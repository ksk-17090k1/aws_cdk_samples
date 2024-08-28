import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";

type Props = {
  vpc: ec2.IVpc;
};

export class SbcntrSg extends Construct {
  readonly sgEgress: ec2.ISecurityGroup;
  readonly sgIngress: ec2.ISecurityGroup;
  readonly sgContainer: ec2.ISecurityGroup;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = props.vpc;

    const sgManagement = new ec2.SecurityGroup(this, "sbcntrSgManagement", {
      vpc,
      allowAllOutbound: true,
      description: "Security Group of management server",
    });

    // FEのpublic subnet用 (つまりALB)
    const sgIngress = new ec2.SecurityGroup(this, "sbcntrSgIngress", {
      vpc,
      allowAllOutbound: true,
      description: "Security group for ingress",
    });
    // internalのALB用 (FEからBEへの接続)
    const sgInternal = new ec2.SecurityGroup(this, "sbcntrSgInternal", {
      vpc,
      allowAllOutbound: true,
      description: "Security group for internal load balancer",
    });
    // BEのアプリケーション用
    const sgContainer = new ec2.SecurityGroup(this, "sbcntrSgContainer", {
      vpc,
      allowAllOutbound: true,
      description: "Security Group of backend app",
    });
    // FEのアプリケーション用 (private subnet)
    const sgFrontContainer = new ec2.SecurityGroup(
      this,
      "sbcntrSgFrontContainer",
      {
        vpc,
        allowAllOutbound: false,
        description: "Security Group of front container app",
      }
    );
    const sgDb = new ec2.SecurityGroup(this, "sbcntrSgDb", {
      vpc,
      allowAllOutbound: true,
      description: "Security Group of database",
    });
    // VPC Endpoint用
    const sgEgress = new ec2.SecurityGroup(this, "sbcntrSgEgress", {
      vpc,
      allowAllOutbound: false,
      description: "Security Group of VPC Endpoint",
    });

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

    // --- FEからBEまでの接続 ---
    // ingress -> frontContainer -> internal -> container
    // NOTE: NATで通信する形に変えたので443も足した
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
    // container -> db
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
    // テストリスナー用
    sgInternal.connections.allowFrom(
      sgManagement,
      ec2.Port.tcp(10080),
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
    this.sgEgress = sgEgress;
    this.sgContainer = sgContainer;
  }
}
