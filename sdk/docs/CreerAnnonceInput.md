
# CreerAnnonceInput

L\'annonce est créée en BROUILLON, avec l\'agent connecté comme auteur. auteurId et statutPublication éventuellement envoyés sont ignorés.

## Properties

Name | Type
------------ | -------------
`titre` | string
`description` | string
`typeBien` | [TypeBienInput](TypeBienInput.md)
`prix` | number
`surface` | number
`ville` | string
`dateDisponibilite` | Date
`photos` | [Array&lt;PhotoInput&gt;](PhotoInput.md)

## Example

```typescript
import type { CreerAnnonceInput } from ''

// TODO: Update the object below with actual values
const example = {
  "titre": null,
  "description": null,
  "typeBien": null,
  "prix": null,
  "surface": null,
  "ville": null,
  "dateDisponibilite": null,
  "photos": null,
} satisfies CreerAnnonceInput

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreerAnnonceInput
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


