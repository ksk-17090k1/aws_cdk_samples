import { Construct } from "constructs";
import { CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  IBucket,
} from "aws-cdk-lib/aws-s3";
import {
  CloudFrontWebDistribution,
  OriginAccessIdentity,
  ViewerCertificate,
  SecurityPolicyProtocol,
  SSLMethod,
} from "aws-cdk-lib/aws-cloudfront";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as certManager from "aws-cdk-lib/aws-certificatemanager";
import * as targets from "aws-cdk-lib/aws-route53-targets";

type Props = {
  deployDomain: string;
};

export class MyPublicDomain extends Construct {
  readonly hostedZone: route53.IHostedZone;
  readonly certificate: certManager.ICertificate;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { deployDomain } = props;

    // ホストゾーンは手動で作成しておくこと
    const hostedZone = route53.HostedZone.fromLookup(this, "MyHostedZone", {
      domainName: deployDomain,
    });

    const cert = new certManager.Certificate(this, "MyCertificate", {
      domainName: deployDomain,
      certificateName: "My Certificate",
      validation: certManager.CertificateValidation.fromDns(hostedZone),
    });

    this.hostedZone = hostedZone;
    this.certificate = cert;
  }
}
