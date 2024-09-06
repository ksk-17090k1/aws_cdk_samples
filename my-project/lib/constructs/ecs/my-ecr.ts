import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as ecrdeploy from "cdk-ecr-deployment";
import * as imagedeploy from "cdk-docker-image-deployment";
import * as ecs from "aws-cdk-lib/aws-ecs";

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

    // --- cdk-ecr-deployment を使う場合 ---
    const dockerImageAsset = new DockerImageAsset(
      this,
      `${resourceName}DockerImageAsset`,
      {
        directory: "./lib/constructs/ecs/",
        platform: Platform.LINUX_AMD64,
      }
    );

    // NOTE: DockerImageAsset はハッシュ値を持つ
    // TODO: ほんとはコミットハッシュをタグにするのが一番良さそうだが、、、
    //       actionsで ${{ github.sha }} を cdk deploy の引数に渡すでいけそう
    const tagName = `prod-${dockerImageAsset.assetHash}`;
    new ecrdeploy.ECRDeployment(this, `${resourceName}DeployDockerImage`, {
      src: new ecrdeploy.DockerImageName(dockerImageAsset.imageUri),
      dest: new ecrdeploy.DockerImageName(
        `${accountId}.dkr.ecr.${region}.amazonaws.com/${ecrRepository.repositoryName}:${tagName}`
      ),
    });

    // --- cdk-docker-image-deployment を使う場合 ---
    // 結論、cdk-ecr-deployment を使うほうがよいかと思う
    // こっちのほうが cdk-ecr-deployment よりは簡潔にかけるが、DockerImageAsset を使わないのでhash値を取得できない
    // NOTE: 厳密には、destinationで指定するtagを省略すると、内部で DockerImageAsset を使ってhash値がタグになるが、
    //       内部で使われているだけなので、外から取得できない
    const tagName2 = "stg-djflivfdnlvnl";
    new imagedeploy.DockerImageDeployment(
      this,
      "ExampleImageDeploymentWithTag",
      {
        source: imagedeploy.Source.directory("./lib/constructs/ecs/"),
        destination: imagedeploy.Destination.ecr(ecrRepository, {
          // ここを省略すると、DockerImageAsset で計算されたhash値がタグになる
          tag: tagName2,
        }),
      }
    );

    // こんな感じで任意のリポジトリでタスク定義に指定できる
    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {});
    taskDef.addContainer("AppContainer", {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepository, tagName),
    });
  }
}
