import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { MyPublicDomain } from "./constructs/domain/publicDomain";

// interface Props extends cdk.StackProps {}  でも良い
type Props = cdk.StackProps & {};

export class MyDomainStack extends cdk.Stack {
  readonly publicDomain: MyPublicDomain;
  constructor(scope: Construct, id: string, props?: Props) {
    super(scope, id, props);

    const domainName = "ksk-17090k1.com";

    const publicDomain = new MyPublicDomain(this, "MyPublicDomain", {
      deployDomain: domainName,
    });
    this.publicDomain = publicDomain;
  }
}
