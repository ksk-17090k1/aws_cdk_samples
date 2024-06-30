
# --- Lefthook ---

init-lefthook:
	@echo "setup lefthook"
	@brew install lefthook
	@lefthook install
# 既存のhooksPathの設定が悪さをする場合があるので削除する
	git config --local --unset core.hooksPath

# --- Node.js ---

package.json:
	npm init

# --- Setup TypeScript ---
.PHONY: ts
up-ts: package.json 
	npm install -D typescript @types/node
	make tsconfig.json

tsconfig.json: 
	npx tsc --init
	@echo "❗tsconfig.jsonの設定を行ってください❗"
	@echo "以下をtrueにすることをオススメします。"
	@echo "noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitReturns"
	@echo "noFallthroughCasesInSwitch, noImplicitOverride"

.PHONY: clean-ts
clean-ts:
	rm -rf node_modules package-lock.json  package.json tsconfig.json

# --- Eslint ---
# 質問への回答はこれを参照のこと：
# https://dev.to/devdammak/setting-up-eslint-in-your-javascript-project-with-vs-code-2amf
.PHONY: up-eslint
up-eslint: package.json 
	npm init @eslint/config@latest
	make up-eslint-react

.PHONY: up-eslint-react
up-eslint-react:
	npm i -D eslint-plugin-react 
	@echo "❗ESLintの設定ファイルに【eslint-plugin-react】の追加設定を行ってください❗"
	@echo "詳細は https://github.com/jsx-eslint/eslint-plugin-react を参照してください"
	npm i -D eslint-plugin-react-hooks 
	@echo "❗ESLintの設定ファイルに【eslint-plugin-react-hooks】の追加設定を行ってください❗"
	@echo "詳細は https://www.npmjs.com/package/eslint-plugin-react-hooks を参照してください"
	
.PHONY: clean-eslint
clean-eslint: 
	rm -rf *eslint.config*
	npm uninstall eslint @eslint/js eslint-plugin-react typescript-eslint
	make clean-eslint-react
	make re-i

.PHONY: clean-eslint-react
clean-eslint-react: 
	npm uninstall eslint-plugin-react eslint-plugin-react-hooks

# --- Prettier ---
# ESLintの設定ファイルに追加設定が必要！詳しくは以下かメモを参照。
# https://github.com/prettier/eslint-config-prettier
.PHONY: up-prettier
up-prettier: .prettierrc .prettierignore
	npm install --save-dev --save-exact prettier
	npm i -D eslint-config-prettier
	@echo "❗ESLintの設定ファイルに【prettier】の追加設定を行ってください❗"
	@echo "詳細は https://github.com/prettier/eslint-config-prettier を参照してください"

.prettierrc:
	node --eval "fs.writeFileSync('.prettierrc','{}\n')"

.prettierignore:
	touch .prettierignore

.PHONY: clean-prettier
clean-prettier:
	rm -rf .prettierrc .prettierignore 
	npm uninstall -D prettier eslint-config-prettier
	make re-i

# --- Vite ---
# viteのinitでeslintは自動で入るが、prettierは入らない
up-vite:
	npm create vite@latest my-react-app -- --template react-ts

# --- node_modules ---
.PHONY: re-i
re-i:
	rm -r node_modules
	npm i

# --- Clasp ---
.PHONY: clasp-init
clasp-install:
	npm i @google/clasp -g
	clasp login

.PHONY: clasp-clone
clasp-clone:
	@echo "clone prod"
	cd ${LLM_EXAM_GAS_DIR}/prod && clasp clone ${LLM_EXAM_GAS_ID_PROD}

.PHONY: clasp-clone-dev
clasp-clone-dev:
	@echo "clone dev"
	cd ${LLM_EXAM_GAS_DIR}/dev && clasp clone ${LLM_EXAM_GAS_ID_DEV}

.PHONY: clasp-create
clasp-create:
	mkdir app
	cd app \
	&& clasp create --title "ClaspApp" --type standalone \
	&& touch main.ts \
	&& code main.ts

# --- AWS CDK ---

account = 737276082677
region = ap-northeast-1
cdk-project = my-project

up-cdk:
	npm install -g aws-cdk
	mkdir ${cdk-project}
	cd ${cdk-project} \
	&& cdk init app --language typescript

cdk-bs:
	cdk bootstrap aws://${account}/${region}