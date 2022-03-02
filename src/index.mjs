#!/usr/bin/env node

import fs from 'fs';
import fsPromises from 'fs/promises';
import { Command } from 'commander/esm.mjs';

const program = new Command();

program.option('-a, --api <apiName>', 'strapi api name', null);
program.option(
  '-s, --select <gp | p | l | r>',
  'choose generate global policy or policy or lifecycle or route',
  null,
);
program.option('-n, --name <name>', 'name of file', 'temp');
program.option('-r, --route <route name>', 'route', 'temp');

program.parse();

const apiName = program.opts().api; // api 名稱
const select = program.opts().select; // 選擇產生 policy 或 global policy或 lifecycle或 route
const name = program.opts().name; // policy名稱
const route = program.opts().route; // lifecycle的方法, policy的route對象, route的路徑

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
          .trimRight()
          .replace(/,$/g, '');

        const fixedJSON = !config
          ? '{"config":{}}'
          : (config + '}}}')
              .replaceAll('global::', '051c33579aa4f')
              .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": ')
              .replaceAll('051c33579aa4f', 'global::')
              .replaceAll(`'`, `"`);

        const fixconfig = JSON.parse(fixedJSON);

        if (!fixconfig.config[route]) {
          fixconfig.config[route] = {
            policies: [`${this.#select === 'gp' ? 'global::' : ''}${this.#name}`],
          };
        } else {
          fixconfig.config[route].policies.push(
            `${this.#select === 'gp' ? 'global::' : ''}${this.#name}`,
          );
        }

        return obj[0] + splitWord + `',${JSON.stringify(fixconfig)})`;

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

(async () => {
  if (!apiName) {
    console.error('Please specify apiName');
    return;
  }

  if (!select) {
    console.error('Please choose generate policy or lifecycle, eg: -s p or -s l');
    return;
  }

  if (select !== 'gp' && select !== 'p' && select !== 'l' && select !== 'r') {
    console.error('Wrong select, please choose gp or p or l');
    return;
  }

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
