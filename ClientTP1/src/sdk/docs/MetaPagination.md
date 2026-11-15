
# MetaPagination

Métadonnées de pagination

## Properties

Name | Type
------------ | -------------
`page` | number
`limit` | number
`total` | number
`pages` | number

## Example

```typescript
import type { MetaPagination } from ''

// TODO: Update the object below with actual values
const example = {
  "page": null,
  "limit": null,
  "total": null,
  "pages": null,
} satisfies MetaPagination

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as MetaPagination
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


