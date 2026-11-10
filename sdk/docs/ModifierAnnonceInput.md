
# ModifierAnnonceInput

Modification partielle : seuls les champs envoyés changent (au moins un).

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
`statutBien` | [StatutBienInput](StatutBienInput.md)

## Example

```typescript
import type { ModifierAnnonceInput } from ''

// TODO: Update the object below with actual values
const example = {
  "titre": null,
  "description": null,
  "typeBien": null,
  "prix": null,
  "surface": null,
  "ville": null,
  "dateDisponibilite": null,
  "statutBien": null,
} satisfies ModifierAnnonceInput

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ModifierAnnonceInput
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


