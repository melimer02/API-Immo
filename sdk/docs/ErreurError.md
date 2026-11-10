
# ErreurError


## Properties

Name | Type
------------ | -------------
`code` | string
`message` | string
`details` | [Array&lt;ErreurErrorDetailsInner&gt;](ErreurErrorDetailsInner.md)

## Example

```typescript
import type { ErreurError } from ''

// TODO: Update the object below with actual values
const example = {
  "code": null,
  "message": null,
  "details": null,
} satisfies ErreurError

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ErreurError
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


