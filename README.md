# strapi-generater

```
yarn add -D https://github.com/skynocover/strapi-generater
```

## 必填

- a: api的名稱
- s: 選擇要產生的內容
  - gp: global policy
  - p: policy
  - l: lifecycle
  - r: route

## Policy

```
yarn generator -a sub-grade -s p -n check-grade -r create  
```

- n: policy的名稱
- r: 要使用這個policy的route

## Lifecycle

```
yarn generator -a subpoena -s l -r beforeUpdate
```

- r: lifecycle的名稱

## Route

```
yarn generator -a subpoena -s r -r batchUpdating
```

- r: 要產生的route的路徑