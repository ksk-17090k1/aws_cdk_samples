import { Construct } from "constructs";

// TODO: StackPropsをextendsしてなくていいのか調査
type Props = {};

// 自作ConstructはConstructを継承する
export class MyTemplateConstruct extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    // おまじない(propsは無いことに注意)
    super(scope, id);
  }
}
