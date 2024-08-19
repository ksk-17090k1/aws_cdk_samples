import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

type Props = {
  vpc: ec2.IVpc;
  sgIngress: ec2.ISecurityGroup;
};

export class SbcntrALbExternal extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = props.vpc;
    const sgIngress = props.sgIngress;

    // subnet idの取得
    const { subnetIds: albSubnetIds } = vpc.selectSubnets({
      subnetGroupName: "sbcntr-subnet-public-ingress",
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      loadBalancerName: `sbcntr-alb-ingress-frontend`,
      vpc: vpc,
      securityGroup: sgIngress,
      internetFacing: true,
      vpcSubnets: {
        subnets: [
          ec2.Subnet.fromSubnetId(this, "ALBSubnet1", albSubnetIds[0]),
          ec2.Subnet.fromSubnetId(this, "ALBSubnet2", albSubnetIds[1]),
        ],
      },
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc: vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/healthcheck",
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
        interval: cdk.Duration.seconds(15),
        timeout: cdk.Duration.seconds(5),
        healthyHttpCodes: "200",
      },
    });

    // addListener() ではデフォルトのリスナールールを設定できる。
    // と言っても、デフォルトルールの優先度は最低、条件は何もマッチしなかったとき、と既定なので、
    // 実質アクションとターゲットグループを指定する形になる。
    // ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.BaseApplicationListenerProps.html
    const listener = alb.addListener("Listener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      // forward
      defaultAction: elbv2.ListenerAction.forward([targetGroup]),
      // forwardの場合 defaultTargetGroups の指定でもOK
      //   defaultTargetGroups: [targetGroup],
      // fixed response
      //   defaultAction: elbv2.ListenerAction.fixedResponse(503, {
      //     contentType: "text/html",
      //     messageBody: "<html lang='en'><body>Service Unavailable!</body></html>",
      //   }),
      // HTTPS使う場合 (もしかしたらsslPolicyの設定も必要？)
      //   certificates: [
      //     {
      //       certificateArn:
      //         "arn:aws:acm:ap-northeast-1:012345678910:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      //     },
      //   ],
      // 'open: true' is the default, you can leave it out if you want. Set it
      // to 'false' and use `listener.connections` if you want to be selective
      // about who can access the load balancer.
      open: true,
    });

    // addTargets() はターゲットグループの作成と、優先度、条件、ターゲットの追加を行う
    // NOTE: addTargets() -> addTargetGroups() -> addAction() の順で抽象度が下がっていくらしい
    //       なので細く設定したい場合はaddAction()を使う
    listener.addTargets("ApplicationFleet", {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(["example.com"]),
        elbv2.ListenerCondition.pathPatterns(["/ok", "/path"]),
        elbv2.ListenerCondition.httpRequestMethods(["GET"]),
      ],
      port: 8080,
      //   targets: [asg],
      //   targets: [
      //     new targets.InstanceTarget(ec2Instance1, 80),
      //     new targets.InstanceTarget(ec2Instance2, 80),
      //   ],
    });
  }
}