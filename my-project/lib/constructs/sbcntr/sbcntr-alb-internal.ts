import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";

type Props = {
  vpc: ec2.IVpc;
  sgContainer: ec2.ISecurityGroup;
  fargateService: elbv2.IApplicationLoadBalancerTarget;
};

export class SbcntrALbInternal extends Construct {
  readonly loadBalancerDnsName: string;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = props.vpc;
    const sgContainer = props.sgContainer;

    // subnet idの取得
    const { subnetIds: albSubnetIds } = vpc.selectSubnets({
      subnetGroupName: "sbcntr-subnet-private-container",
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      loadBalancerName: `sbcntr-alb-internal`,
      vpc: vpc,
      securityGroup: sgContainer,
      internetFacing: false,
      vpcSubnets: {
        subnets: [
          ec2.Subnet.fromSubnetId(this, "ALBSubnet1", albSubnetIds[0]),
          ec2.Subnet.fromSubnetId(this, "ALBSubnet2", albSubnetIds[1]),
        ],
      },
    });

    const targetGroupBlue = new elbv2.ApplicationTargetGroup(
      this,
      "TargetGroupBlue",
      {
        targetGroupName: `sbcntr-tg-blue`,
        vpc: vpc,
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          path: "/healthcheck",
          healthyThresholdCount: 3,
          unhealthyThresholdCount: 2,
          interval: cdk.Duration.seconds(15),
          timeout: cdk.Duration.seconds(5),
          healthyHttpCodes: "200",
        },
      }
    );
    targetGroupBlue.addTarget(props.fargateService);

    const listener = alb.addListener("Listener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([targetGroupBlue]),
    });

    this.loadBalancerDnsName = alb.loadBalancerDnsName;
  }
}
