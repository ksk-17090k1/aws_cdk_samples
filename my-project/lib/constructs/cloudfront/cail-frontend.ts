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
import { NodejsBuild } from "deploy-time-build";
import { Auth } from "./auth";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as certManager from "aws-cdk-lib/aws-certificatemanager";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import { Idp } from "../utils/identity-provider";
import { NagSuppressions } from "cdk-nag";

// TODO: 必要なところだけ抜き出してメモにする

export interface FrontendProps {
  // readonly webAclId: string;
  readonly deployDomain: string;
  readonly enableMistral: boolean;
  readonly accessLogBucket?: IBucket;
  // readonly enableIpV6: boolean;
}

export class Frontend extends Construct {
  readonly cloudFrontWebDistribution: CloudFrontWebDistribution;
  readonly assetBucket: Bucket;
  readonly deployDomain: string;
  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id);

    this.deployDomain = props.deployDomain;

    // ホストゾーンは手動で作成しておくこと
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: `${this.deployDomain}.`,
    });
    // DnsValidatedCertificateがdeprecatedだが、
    // クロスリージョン対応が必要になるため一旦そのままにする
    // 参考：https://qiita.com/hibohiboo/items/82e5ed43754a41f60108
    const cert = new certManager.DnsValidatedCertificate(this, "Certificate", {
      domainName: this.deployDomain,
      hostedZone,
      region: "us-east-1",
    });

    const assetBucket = new Bucket(this, "AssetBucket", {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsBucket: props.accessLogBucket,
      serverAccessLogsPrefix: "AssetBucket",
    });

    const originAccessIdentity = new OriginAccessIdentity(
      this,
      "OriginAccessIdentity"
    );
    const distribution = new CloudFrontWebDistribution(this, "Distribution", {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: assetBucket,
            originAccessIdentity,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
            },
          ],
        },
      ],
      errorConfigurations: [
        {
          errorCode: 404,
          errorCachingMinTtl: 0,
          responseCode: 200,
          responsePagePath: "/",
        },
        {
          errorCode: 403,
          errorCachingMinTtl: 0,
          responseCode: 200,
          responsePagePath: "/",
        },
      ],
      ...(!this.shouldSkipAccessLogging() && {
        loggingConfig: {
          bucket: props.accessLogBucket,
          prefix: "Frontend/",
        },
      }),
      viewerCertificate: ViewerCertificate.fromAcmCertificate(cert, {
        aliases: [this.deployDomain],
        securityPolicy: SecurityPolicyProtocol.TLS_V1_2_2021,
        sslMethod: SSLMethod.SNI,
      }),
      // webACLId: props.webAclId,
      // enableIpV6: props.enableIpV6,
    });

    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: "AwsPrototyping-CloudFrontDistributionGeoRestrictions",
        reason: "this asset is being used all over the world",
      },
    ]);

    const propsForRoute53Records = {
      zone: hostedZone,
      recordName: this.deployDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    };
    new route53.ARecord(this, "ARecord", propsForRoute53Records);

    this.assetBucket = assetBucket;
    this.cloudFrontWebDistribution = distribution;
  }

  getOrigin(): string {
    // CAIL Custom Domain
    // return `https://${this.cloudFrontWebDistribution.distributionDomainName}`;
    return `https://${this.deployDomain}`;
  }

  buildViteApp({
    backendApiEndpoint,
    webSocketApiEndpoint,
    userPoolDomainPrefix,
    enableMistral,
    auth,
    idp,
  }: {
    backendApiEndpoint: string;
    webSocketApiEndpoint: string;
    userPoolDomainPrefix: string;
    enableMistral: boolean;
    auth: Auth;
    idp: Idp;
  }) {
    const region = Stack.of(auth.userPool).region;
    const cognitoDomain = `${userPoolDomainPrefix}.auth.${region}.amazoncognito.com/`;
    const buildEnvProps = (() => {
      const defaultProps = {
        VITE_APP_API_ENDPOINT: backendApiEndpoint,
        VITE_APP_WS_ENDPOINT: webSocketApiEndpoint,
        VITE_APP_USER_POOL_ID: auth.userPool.userPoolId,
        VITE_APP_USER_POOL_CLIENT_ID: auth.client.userPoolClientId,
        VITE_APP_ENABLE_MISTRAL: enableMistral.toString(),
        VITE_APP_REGION: region,
        VITE_APP_USE_STREAMING: "true",
      };

      if (!idp.isExist()) return defaultProps;

      const oAuthProps = {
        VITE_APP_REDIRECT_SIGNIN_URL: this.getOrigin(),
        VITE_APP_REDIRECT_SIGNOUT_URL: this.getOrigin(),
        VITE_APP_COGNITO_DOMAIN: cognitoDomain,
        VITE_APP_SOCIAL_PROVIDERS: idp.getSocialProviders(),
        VITE_APP_CUSTOM_PROVIDER_ENABLED: idp
          .checkCustomProviderEnabled()
          .toString(),
        VITE_APP_CUSTOM_PROVIDER_NAME: idp.getCustomProviderName(),
      };
      return { ...defaultProps, ...oAuthProps };
    })();

    new NodejsBuild(this, "ReactBuild", {
      assets: [
        {
          path: "../frontend",
          exclude: [
            "node_modules",
            "dist",
            "dev-dist",
            ".env",
            ".env.local",
            "../cdk/**/*",
            "../backend/**/*",
            "../example/**/*",
            "../docs/**/*",
            "../.github/**/*",
          ],
          commands: ["npm ci"],
        },
      ],
      buildCommands: [
        // ビルド時に JavaScript heap out of memory エラーが発生するためメモリを増やす
        "NODE_OPTIONS='--max-old-space-size=4096' && npm run build",
      ],
      buildEnvironment: buildEnvProps,
      destinationBucket: this.assetBucket,
      distribution: this.cloudFrontWebDistribution,
      outputSourceDirectory: "dist",
    });

    if (idp.isExist()) {
      new CfnOutput(this, "CognitoDomain", { value: cognitoDomain });
      new CfnOutput(this, "SocialProviders", {
        value: idp.getSocialProviders(),
      });
    }
  }

  /**
   * CloudFront does not support access log delivery in the following regions
   * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/AccessLogs.html#access-logs-choosing-s3-bucket
   */
  private shouldSkipAccessLogging(): boolean {
    const skipLoggingRegions = [
      "af-south-1",
      "ap-east-1",
      "ap-south-2",
      "ap-southeast-3",
      "ap-southeast-4",
      "ca-west-1",
      "eu-south-1",
      "eu-south-2",
      "eu-central-2",
      "il-central-1",
      "me-central-1",
    ];
    return skipLoggingRegions.includes(Stack.of(this).region);
  }
}
