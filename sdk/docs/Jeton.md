
# Jeton


## Properties

Name | Type
------------ | -------------
`token` | string
`tokenType` | string
`expiresIn` | string

## Example

```typescript
import type { Jeton } from ''

// TODO: Update the object below with actual values
const example = {
  "token": null,
  "tokenType": null,
  "expiresIn": null,
} satisfies Jeton

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Jeton
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


