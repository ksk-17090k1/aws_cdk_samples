import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MyBasicEc2 } from "./constructs/ec2/my-basic-ec2";
import { MyDesignatedSubnetEc2 } from "./constructs/ec2/my-designated-subnet-ec2";
import { MyCustomEc2 } from "./constructs/ec2/my-custom-ec2";
import { MySSMPublicEc2 } from "./constructs/ec2/my-ssm-public-ec2";

type Props = cdk.StackProps & {};

export class MyEc2Stack extends cdk.Stack {
  readonly outputSample: cdk.CfnOutput;
  constructor(scope: Construct, id: string, props?: Props) {
    super(scope, id, props);

    // new MyBasicEc2(this, "MyBasicEc2", {});
    // new MyDesignatedSubnetEc2(this, "MyDesgnatedSubnetEc2", {});
    // new MyCustomEc2(this, "MyCustomEc2", {});
    new MySSMPublicEc2(this, "MySSMPublicEc2", {});
  }
}
