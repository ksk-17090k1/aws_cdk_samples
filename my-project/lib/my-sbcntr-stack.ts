import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SbcntrVpc } from "./constructs/ecs/sbcntr-vpc";
import { SbcntrSg } from "./constructs/ecs/sbcntr-sg";
import { SbcntrVpcEndPoint } from "./constructs/ecs/sbcntr-vpc-endpoint";
import { SbcntrALbInternal } from "./constructs/ecs/sbcntr-alb-internal";
import { MyPrivateEcs } from "./constructs/ecs/my-private-ecs";
import { MyPublicEcs } from "./constructs/ecs/my-public-ecs";
import { MyPrivateNatEcs } from "./constructs/ecs/my-private-nat-ecs";

type Props = cdk.StackProps & {};

export class MySbcntrStack extends cdk.Stack {
  readonly outputSample: cdk.CfnOutput;
  constructor(scope: Construct, id: string, props?: Props) {
    super(scope, id, props);

    const vpc = new SbcntrVpc(this, "SbcntrVpc", {});
    const sg = new SbcntrSg(this, "SbcntrSg", {
      vpc: vpc.vpc,
    });

    // new SbcntrVpcEndPoint(this, "SbcntrVpcEndPoint", {
    //   vpc: vpc.vpc,
    //   sgEgress: sg.sgEgress,
    // });

    // new SbcntrALbInternal(this, "SbcntrALbInternal", {
    //   vpc: vpc.vpc,
    //   sgContainer: sg.sgContainer,
    // });

    new MyPublicEcs(this, "MyBasicEcs", {});
    // new MyPrivateNatEcs(this, "MyPrivateNatEcs", {});
    // new MyPrivateEcs(this, "MyPrivateEcs", {
    //   vpc: vpc.vpc,
    //   sgContainer: sg.sgContainer,
    // });
  }
}
