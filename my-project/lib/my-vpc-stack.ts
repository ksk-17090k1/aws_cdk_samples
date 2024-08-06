import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MyBasicVpc } from "./constructs/vpc/my-basic-vpc";
import { MySubnetConfigVpc } from "./constructs/vpc/my-subnet-config-vpc";
import { MyCustomSubnetVpc } from "./constructs/vpc/my-custom-subnet-vpc";
import { MySpecificallyCustomSubnetVpc } from "./constructs/vpc/my-specifically-custom-subnet-vpc";

type Props = cdk.StackProps & {};

export class MyVpcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: Props) {
    super(scope, id, props);

    new MyBasicVpc(this, "MyBasicVpc", {});
    new MySubnetConfigVpc(this, "MySubnetConfigVpC", {});
    new MyCustomSubnetVpc(this, "MyCustomSubnetVpc", {});
    new MySpecificallyCustomSubnetVpc(
      this,
      "MySpecificallyCustomSubnetVpc",
      {}
    );
  }
}
