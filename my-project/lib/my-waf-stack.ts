import * as cdk from "aws-cdk-lib";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";
import { Waf } from "./constructs/waf/my-waf";

export class MyWafStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const waf = new Waf(this, "Waf");
    new Distribution(this, "Distribution", {
      defaultBehavior: { origin: new HttpOrigin("example.com") },
      webAclId: waf.webAclId,
    });
  }
}
