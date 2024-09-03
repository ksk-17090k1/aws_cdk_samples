import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MyEcr } from "./constructs/ecs/my-ecr";

type Props = cdk.StackProps & {
  accountId: string | undefined;
  region: string;
  resourceName: string;
};

export class MyEcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    new MyEcr(this, "MyEcr", {
      resourceName: props.resourceName,
      accountId: props.accountId,
      region: props.region,
    });
  }
}
