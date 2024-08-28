import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SbcntrVpc } from "./constructs/sbcntr/sbcntr-vpc";
import { SbcntrSg } from "./constructs/sbcntr/sbcntr-sg";
import { SbcntrALbInternal } from "./constructs/sbcntr/sbcntr-alb-internal";
import { SbcntrEcsBackend } from "./constructs/sbcntr/sbcntr-ecs-backend";
import { SbcntrEcsFrontend } from "./constructs/sbcntr/sbcntr-ecs-frontend";
import { SbcntrALbExternal } from "./constructs/sbcntr/sbcntr-alb-external";

type Props = cdk.StackProps & {};

export class MySbcntrStack extends cdk.Stack {
  readonly outputSample: cdk.CfnOutput;
  constructor(scope: Construct, id: string, props?: Props) {
    super(scope, id, props);

    const vpc = new SbcntrVpc(this, "SbcntrVpc", {});
    const sg = new SbcntrSg(this, "SbcntrSg", {
      vpc: vpc.vpc,
    });
    const ecsBackend = new SbcntrEcsBackend(this, "SbcntrEcsBackend", {
      vpc: vpc.vpc,
      sgService: sg.sgContainer,
    });
    const albInternal = new SbcntrALbInternal(this, "SbcntrALbInternal", {
      vpc: vpc.vpc,
      sgContainer: sg.sgContainer,
      fargateService: ecsBackend.fargateService,
    });

    // const ecsFrontend = new SbcntrEcsFrontend(this, "SbcntrEcsFrontend", {
    //   vpc: vpc.vpc,
    //   sgService: sg.sgIngress,
    //   backendHost: albInternal.loadBalancerDnsName,
    // });

    // new SbcntrALbExternal(this, "SbcntrALbExternal", {
    //   vpc: vpc.vpc,
    //   sgIngress: sg.sgIngress,
    //   fargateService: ecsFrontend.fargateService,
    // });
  }
}
