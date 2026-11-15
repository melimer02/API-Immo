
# InscriptionInput

Tout autre champ (role, statutPro…) est ignoré : un compte créé ici est toujours USER.

## Properties

Name | Type
------------ | -------------
`name` | string
`email` | string
`password` | string

## Example

```typescript
import type { InscriptionInput } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "email": null,
  "password": null,
} satisfies InscriptionInput

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as InscriptionInput
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


