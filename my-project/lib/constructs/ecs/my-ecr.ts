import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as ecrdeploy from "cdk-ecr-deployment";

type Props = {
  accountId: string | undefined;
  region: string;
  resourceName: string;
};

export class MyEcr extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { accountId, region, resourceName } = props;
    if (accountId == null) {
      throw new Error("accountId is required");
    }

    // Create ECR Repository
    const ecrRepository = new ecr.Repository(this, `${resourceName}EcrRepo`, {
      repositoryName: `${resourceName}`,
      // イメージが存在しないリポジトリはdestroy時に削除
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // イメージが含まれるリポジトリもdestroy時に削除
      emptyOnDelete: true,
      lifecycleRules: [
        {
          description: "delete old images",
          rulePriority: 1,
          // タグがついている、ついていないに関わらずすべてのイメージを対象
          tagStatus: ecr.TagStatus.ANY,
          // maxImageAge か maxImageCount のどちらかのみを指定
          //   maxImageAge: cdk.Duration.days(365),
          maxImageCount: 3,
        },
      ],
      // push時にスキャンを実施
      imageScanOnPush: true,
      // 基本immutableにすべき
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
    });

    // Create Docker Image Asset
    const dockerImageAsset = new DockerImageAsset(
      this,
      `${resourceName}DockerImageAsset`,
      {
        directory: "./lib/constructs/ecs/",
        platform: Platform.LINUX_AMD64,
      }
    );

    // Deploy Docker Image to ECR Repository
    const tagName = "v1";
    new ecrdeploy.ECRDeployment(this, `${resourceName}DeployDockerImage`, {
      src: new ecrdeploy.DockerImageName(dockerImageAsset.imageUri),
      dest: new ecrdeploy.DockerImageName(
        `${accountId}.dkr.ecr.${region}.amazonaws.com/${ecrRepository.repositoryName}:${tagName}`
      ),
    });
  }
}
