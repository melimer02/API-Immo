# QuestionsApi

All URIs are relative to *http://localhost:3000*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**lireQuestion**](QuestionsApi.md#lirequestion) | **GET** /questions/{id} | Détail d\&#39;une question |
| [**listerQuestions**](QuestionsApi.md#listerquestions) | **GET** /annonces/{id}/questions | Questions posées sur une annonce (avec leur réponse) |
| [**poserQuestion**](QuestionsApi.md#poserquestion) | **POST** /annonces/{id}/questions | Poser une question sur une annonce publiée |
| [**repondreQuestion**](QuestionsApi.md#repondrequestion) | **POST** /questions/{id}/reponse | Répondre à une question posée sur une de mes annonces |



## lireQuestion

> Question lireQuestion(id)

Détail d\&#39;une question

### Example

```ts
import {
  Configuration,
  QuestionsApi,
} from '';
import type { LireQuestionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new QuestionsApi(config);

  const body = {
    // number | Identifiant numérique de la ressource
    id: 56,
  } satisfies LireQuestionRequest;

  try {
    const data = await api.lireQuestion(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `number` | Identifiant numérique de la ressource | [Defaults to `undefined`] |

### Return type

[**Question**](Question.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **400** | Requête invalide (body, query ou path) — VALIDATION_FAILED ou BAD_REQUEST |  -  |
| **401** | Jeton absent, invalide ou expiré — UNAUTHENTICATED |  -  |
| **404** | Ressource inexistante OU appartenant à un autre utilisateur (indiscernables volontairement) — NOT_FOUND |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listerQuestions

> PageQuestions listerQuestions(id, page, limit)

Questions posées sur une annonce (avec leur réponse)

### Example

```ts
import {
  Configuration,
  QuestionsApi,
} from '';
import type { ListerQuestionsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new QuestionsApi(config);

  const body = {
    // number | Identifiant numérique de la ressource
    id: 56,
    // number | Numéro de page (à partir de 1) (optional)
    page: 56,
    // number | Nombre d\'éléments par page (100 maximum) (optional)
    limit: 56,
  } satisfies ListerQuestionsRequest;

  try {
    const data = await api.listerQuestions(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `number` | Identifiant numérique de la ressource | [Defaults to `undefined`] |
| **page** | `number` | Numéro de page (à partir de 1) | [Optional] [Defaults to `1`] |
| **limit** | `number` | Nombre d\&#39;éléments par page (100 maximum) | [Optional] [Defaults to `20`] |

### Return type

[**PageQuestions**](PageQuestions.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **400** | Requête invalide (body, query ou path) — VALIDATION_FAILED ou BAD_REQUEST |  -  |
| **401** | Jeton absent, invalide ou expiré — UNAUTHENTICATED |  -  |
| **404** | Ressource inexistante OU appartenant à un autre utilisateur (indiscernables volontairement) — NOT_FOUND |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## poserQuestion

> Question poserQuestion(id, nouvelleQuestionInput)

Poser une question sur une annonce publiée

Tout utilisateur connecté. 404 si l\&#39;annonce n\&#39;existe pas ou n\&#39;est pas publiée. 201 avec Location: /questions/{id}.

### Example

```ts
import {
  Configuration,
  QuestionsApi,
} from '';
import type { PoserQuestionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new QuestionsApi(config);

  const body = {
    // number | Identifiant numérique de la ressource
    id: 56,
    // NouvelleQuestionInput
    nouvelleQuestionInput: ...,
  } satisfies PoserQuestionRequest;

  try {
    const data = await api.poserQuestion(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `number` | Identifiant numérique de la ressource | [Defaults to `undefined`] |
| **nouvelleQuestionInput** | [NouvelleQuestionInput](NouvelleQuestionInput.md) |  | |

### Return type

[**Question**](Question.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Default Response |  -  |
| **400** | Requête invalide (body, query ou path) — VALIDATION_FAILED ou BAD_REQUEST |  -  |
| **401** | Jeton absent, invalide ou expiré — UNAUTHENTICATED |  -  |
| **404** | Ressource inexistante OU appartenant à un autre utilisateur (indiscernables volontairement) — NOT_FOUND |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## repondreQuestion

> Reponse repondreQuestion(id, nouvelleReponseInput)

Répondre à une question posée sur une de mes annonces

Agent propriétaire de l\&#39;annonce (ou ADMIN). 404 si la question porte sur l\&#39;annonce d\&#39;un autre agent, 409 si elle a déjà une réponse.

### Example

```ts
import {
  Configuration,
  QuestionsApi,
} from '';
import type { RepondreQuestionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new QuestionsApi(config);

  const body = {
    // number | Identifiant numérique de la ressource
    id: 56,
    // NouvelleReponseInput
    nouvelleReponseInput: ...,
  } satisfies RepondreQuestionRequest;

  try {
    const data = await api.repondreQuestion(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `number` | Identifiant numérique de la ressource | [Defaults to `undefined`] |
| **nouvelleReponseInput** | [NouvelleReponseInput](NouvelleReponseInput.md) |  | |

### Return type

[**Reponse**](Reponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Default Response |  -  |
| **400** | Requête invalide (body, query ou path) — VALIDATION_FAILED ou BAD_REQUEST |  -  |
| **401** | Jeton absent, invalide ou expiré — UNAUTHENTICATED |  -  |
| **403** | Le rôle ne permet pas l\&#39;opération  ou agent non validé — FORBIDDEN |  -  |
| **404** | Ressource inexistante OU appartenant à un autre utilisateur (indiscernables volontairement) — NOT_FOUND |  -  |
| **409** | Conflit avec l\&#39;état actuel — EMAIL_ALREADY_USED, QUESTION_ALREADY_ANSWERED |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

