
# Question


## Properties

Name | Type
------------ | -------------
`id` | number
`annonceId` | number
`contenu` | string
`createdAt` | Date
`auteur` | [AuteurPublic](AuteurPublic.md)
`reponse` | [Reponse](Reponse.md)

## Example

```typescript
import type { Question } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "annonceId": null,
  "contenu": null,
  "createdAt": null,
  "auteur": null,
  "reponse": null,
} satisfies Question

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Question
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


