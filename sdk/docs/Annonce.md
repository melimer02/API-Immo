
# Annonce


## Properties

Name | Type
------------ | -------------
`id` | number
`titre` | string
`description` | string
`typeBien` | [TypeBien](TypeBien.md)
`statutPublication` | [StatutPublication](StatutPublication.md)
`statutBien` | [StatutBien](StatutBien.md)
`prix` | number
`surface` | number
`ville` | string
`dateDisponibilite` | Date
`createdAt` | Date
`updatedAt` | Date
`auteur` | [AuteurPublic](AuteurPublic.md)
`photos` | [Array&lt;AnnoncePhotosInner&gt;](AnnoncePhotosInner.md)

## Example

```typescript
import type { Annonce } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "titre": null,
  "description": null,
  "typeBien": null,
  "statutPublication": null,
  "statutBien": null,
  "prix": null,
  "surface": null,
  "ville": null,
  "dateDisponibilite": null,
  "createdAt": null,
  "updatedAt": null,
  "auteur": null,
  "photos": null,
} satisfies Annonce

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Annonce
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


