import { Construct } from "constructs";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  ObjectOwnership,
  StorageClass,
} from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";

type Props = {};

export class MyTemplateConstruct extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);
    const myBucket = new Bucket(this, "MyBucket", {
      // 指定しないと自動生成される
      bucketName: "test-my-bucket",
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      // 基本trueでよさそう
      // S3でstatic website hostingした場合はここの設定は無視される
      enforceSSL: true,
      // バージョニングをするか（デフォルトはfalse）
      versioned: false,
      // BUCKET_OWNER_ENFORCED のがいいかも
      // OBJECT_WRITER はバケットにオブジェクトをアップロードしたアカウントがオブジェクトのオーナーになる
      // BUCKET_OWNER_PREFERRED はACLに bucket-owner-full-control を含めるとバケット所有アカウントがオーナーになる
      // BUCKET_OWNER_ENFORCED はACLをオフにする。つまり必ずバケット所有アカウントがオーナーになる
      objectOwnership: ObjectOwnership.OBJECT_WRITER,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      // server access log: S3バケット内のオブジェクトに対する操作やアクセスをログとして記録する機能
      //   serverAccessLogsBucket: accessLogBucket,
      //   serverAccessLogsPrefix: "LargeMessageBucket",
      // life cycle refs: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.LifecycleRule.html
      lifecycleRules: [
        // NOTE: 下記はtransitionとexpirationを別個のルールで書いているが、同じルールで書くことも可能
        // transitionのルール
        {
          id: "transitionToGlacier",
          enabled: true,
          transitions: [
            {
              storageClass: StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: cdk.Duration.minutes(30),
            },
          ],
        },
        // expirationのルール
        {
          id: "DeleteExpiredData",
          enabled: true,
          expiration: cdk.Duration.days(90),
          // 特定のprefixのみにフィルタ
          prefix: "prefix",
        },
      ],
    });
  }
}
