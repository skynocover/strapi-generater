#!/usr/bin/env node

import fs from 'fs';
import fsPromises from 'fs/promises';
import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';

const helloWord = () => {
  console.log(
    chalk.green(
      figlet.textSync('Strapi Generator', {
        font: 'ANSI Shadow',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      }),
    ),
  );
};
class Api {
  #apiName;
  #select;
  #name;
  #route;
  #folderPath;
  #defaultContent;

  constructor(inputData) {
    this.#apiName = inputData.apiName;
    this.#select = inputData.select;
    this.#name = inputData.name; // 要修改或產生的檔案名稱
    this.#route = inputData.route; // 指定的route或lifecycle的method

    // 做出路徑及檔名
    switch (inputData.select) {
      case 'p':
        this.#folderPath = `src/api/${inputData.apiName}/policies`;
        break;
      case 'gp':
        this.#folderPath = 'src/policies';
        break;
      case 'l':
        this.#folderPath = `src/api/${inputData.apiName}/content-types/${inputData.apiName}`;
        this.#name = 'lifecycles';
        break;
      case 'r':
        this.#folderPath = `src/api/${inputData.apiName}/routes`;
        this.#name = `custom-${inputData.apiName}`;
        break;
    }

    // 檔案預設的內容
    switch (this.#select) {
      case 'p':
      case 'gp':
        this.#defaultContent = `
            module.exports = async (policyContext, config, { strapi }) => {
              if (policyContext.state.user.role.name === 'Administrator') {
                return true;
              }
              return false;
            };
            `;
        break;
      case 'l':
        this.#defaultContent = `module.exports = {};`;
        break;
      case 'r':
        this.#defaultContent = `module.exports = {routes: []};`;
        break;
    }
  }

  // 產生預設的內容及檔案
  async makefile() {
    if (!fs.existsSync(this.#folderPath)) {
      await fsPromises.mkdir(this.#folderPath);
    }

    if (!fs.existsSync(`${this.#folderPath}/${this.#name}.js`)) {
      await fsPromises.writeFile(`${this.#folderPath}/${this.#name}.js`, this.#defaultContent);
    }
  }

  // 回傳要修改檔案的路徑
  configFilePath() {
    switch (this.#select) {
      // lifecycle 會對產生的檔案做修改
      case 'l':
      case 'r':
        return `${this.#folderPath}/${this.#name}.js`;
      // policy 會對route做修改
      case 'p':
      case 'gp':
        return `src/api/${this.#apiName}/routes/${this.#apiName}.js`;
    }
  }

  // 回傳要修改的檔案內容
  async addConfig() {
    const content = (await fsPromises.readFile(this.configFilePath())).toString();

    switch (this.#select) {
      case 'p':
      case 'gp':
        const splitWord = `api::${this.#apiName}.${this.#apiName}`;
        const obj = content.split(splitWord);

        const configTemp1 = obj[1].substring(obj[1].indexOf('{') - 1);
        const configTemp2 = configTemp1.substring(0, configTemp1.lastIndexOf('},'));
        const config = configTemp2
          .substring(0, configTemp2.lastIndexOf('}'))
          .trimEnd()
          .replace(/,$/g, '');

        const fixedJSON = !config
          ? '{"config":{}}'
          : (config + '}}}')
              .replaceAll('global::', '051c33579aa4f')
              .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": ')
              .replaceAll('051c33579aa4f', 'global::')
              .replaceAll(`'`, `"`);

        const fixConfig = JSON.parse(fixedJSON);

        if (!fixConfig.config[this.#route]) {
          fixConfig.config[this.#route] = {
            policies: [`${this.#select === 'gp' ? 'global::' : ''}${this.#name}`],
          };
        } else {
          fixConfig.config[this.#route].policies.push(
            `${this.#select === 'gp' ? 'global::' : ''}${this.#name}`,
          );
        }

        return obj[0] + splitWord + `',${JSON.stringify(fixConfig)})`;

      case 'l':
        const currentLifecycle = content.substring(0, content.lastIndexOf('}'));
        return (
          currentLifecycle +
          `
          async ${this.#route}(event) {
            const { data, where, select, populate } = event.params;
            //  const { result, params } = event;
          }}
          `
        );

      case 'r':
        const currentCustom = content.substring(0, content.lastIndexOf(']'));

        return (
          currentCustom +
          `
          {
            method: 'POST',
            path: '/${this.#apiName}/${this.#route}',
            handler: '${this.#apiName}.${this.#route}',
            config: { policies: [] },
          },]}
          `
        );
    }
  }
}

const defaultQuestions = async () => {
  const apis = (await fsPromises.readdir('src/api', { withFileTypes: true }))
    .filter((item) => item.isDirectory())
    .map((item) => item.name);

  const questions = [
    {
      type: 'list',
      name: 'apiName',
      message: 'What is the name of API?',
      choices: apis,
    },
    {
      type: 'list',
      name: 'select',
      message: 'Choose the content to generate:',
      choices: ['global policy', 'api policy', 'lifecycle', 'route'],
      filter: (val) => {
        switch (val) {
          case 'global policy':
            return 'gp';
          case 'api policy':
            return 'p';
          case 'lifecycle':
            return 'l';
          case 'route':
            return 'r';
        }
      },
    },
  ];
  return inquirer.prompt(questions);
};

const routeQuestion = (select) => {
  switch (select) {
    case 'p':
    case 'gp':
      return inquirer.prompt([
        {
          type: 'list',
          name: 'route',
          message: 'Choose core route:',
          choices: ['create', 'find', 'findOne', 'update', 'delete'],
        },
      ]);
    case 'l':
      return inquirer.prompt([
        {
          type: 'list',
          name: 'route',
          message: 'Choose lifecycle events:',
          pageSize: 18,
          choices: [
            'beforeCreate',
            'beforeCreateMany',
            'afterCreate',
            'afterCreateMany',
            'beforeUpdate',
            'beforeUpdateMany',
            'afterUpdate',
            'afterUpdateMany',
            'beforeDelete',
            'beforeDeleteMany',
            'afterDelete',
            'afterDeleteMany',
            'beforeCount',
            'afterCount',
            'beforeFindOne',
            'afterFindOne',
            'beforeFindMany',
            'afterFindMany',
          ],
        },
      ]);
    case 'r':
      return inquirer.prompt([
        {
          type: 'input',
          name: 'route',
          message: 'Please Input Custom Route',
        },
      ]);
  }
};

const policyNameQuestion = (select) => {
  if (select === 'p' || select === 'gp') {
    return inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Please Input Policy Name',
      },
    ]);
  }
  return { name: '' };
};

(async () => {
  helloWord();

  const { apiName, select } = await defaultQuestions();
  if (!apiName) {
    console.error('Please input apiName!');
    return;
  }

  const { route } = await routeQuestion(select);
  const { name } = await policyNameQuestion(select);

  const api = new Api({ apiName, select, name, route });

  // 確認是否有這個檔案,沒有的話就產生
  await api.makefile();

  // 修改此檔案
  await fsPromises.writeFile(api.configFilePath(), await api.addConfig());

  // 客製化route需要另外修改controller
  if (select === 'r') {
    const fileName = `src/api/${apiName}/controllers/${apiName}.js`;
    const controller = (await fsPromises.readFile(fileName)).toString();

    const obj = controller.split(`'api::${apiName}.${apiName}'`);

    let res = '';

    if (obj[1].startsWith(')')) {
      res = `${obj[0]}'api::${apiName}.${apiName}', ({ strapi }) => ({async ${route}(ctx) {}}));`;
    } else {
      res = controller.substring(0, controller.lastIndexOf('}')) + `async ${route}(ctx) {},}));`;
    }
    await fsPromises.writeFile(fileName, res);
  }
})();
