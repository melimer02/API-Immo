# AnnoncesApi

All URIs are relative to *http://localhost:3000*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**creerAnnonce**](AnnoncesApi.md#creerannonce) | **POST** /annonces | Créer une annonce (brouillon) |
| [**depublierAnnonce**](AnnoncesApi.md#depublierannonce) | **DELETE** /annonces/{id}/publication | Dépublier une annonce (retour en brouillon) |
| [**lireAnnonce**](AnnoncesApi.md#lireannonce) | **GET** /annonces/{id} | Détail d\&#39;une annonce |
| [**listerAnnonces**](AnnoncesApi.md#listerannonces) | **GET** /annonces | Liste paginée et filtrée des annonces publiées |
| [**mesAnnonces**](AnnoncesApi.md#mesannonces) | **GET** /me/annonces | Mes annonces (brouillons compris) |
| [**modifierAnnonce**](AnnoncesApi.md#modifierannonce) | **PATCH** /annonces/{id} | Modifier une annonce (champs envoyés uniquement) |
| [**publierAnnonce**](AnnoncesApi.md#publierannonce) | **PUT** /annonces/{id}/publication | Publier une annonce |
| [**supprimerAnnonce**](AnnoncesApi.md#supprimerannonce) | **DELETE** /annonces/{id} | Supprimer une annonce |



## creerAnnonce

> Annonce creerAnnonce(creerAnnonceInput)

Créer une annonce (brouillon)

AGENT ou ADMIN. Réponse 201 avec l\&#39;en-tête Location: /annonces/{id}.

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { CreerAnnonceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // CreerAnnonceInput
    creerAnnonceInput: ...,
  } satisfies CreerAnnonceRequest;

  try {
    const data = await api.creerAnnonce(body);
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
| **creerAnnonceInput** | [CreerAnnonceInput](CreerAnnonceInput.md) |  | |

### Return type

[**Annonce**](Annonce.md)

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
| **403** | Le rôle ne permet pas l\&#39;opération, ou agent non validé — FORBIDDEN |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## depublierAnnonce

> Publication depublierAnnonce(id)

Dépublier une annonce (retour en brouillon)

Idempotent.

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { DepublierAnnonceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // number | Identifiant numérique de la ressource
    id: 56,
  } satisfies DepublierAnnonceRequest;

  try {
    const data = await api.depublierAnnonce(body);
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

[**Publication**](Publication.md)

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
| **403** | Le rôle ne permet pas l\&#39;opération, ou agent non validé — FORBIDDEN |  -  |
| **404** | Ressource inexistante OU appartenant à un autre utilisateur (indiscernables volontairement) — NOT_FOUND |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## lireAnnonce

> Annonce lireAnnonce(id)

Détail d\&#39;une annonce

Public pour une annonce publiée. Un brouillon n\&#39;est visible que par son auteur et les admins : pour tout autre appelant, 404.

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { LireAnnonceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // number | Identifiant numérique de la ressource
    id: 56,
  } satisfies LireAnnonceRequest;

  try {
    const data = await api.lireAnnonce(body);
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

[**Annonce**](Annonce.md)

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


## listerAnnonces

> PageAnnonces listerAnnonces(page, limit, ville, type, prixMax)

Liste paginée et filtrée des annonces publiées

Public. Ne renvoie jamais de brouillon, quel que soit l\&#39;appelant (réponse identique pour tous).

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { ListerAnnoncesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AnnoncesApi();

  const body = {
    // number | Numéro de page (à partir de 1) (optional)
    page: 56,
    // number | Nombre d\'éléments par page (100 maximum) (optional)
    limit: 56,
    // string | Ville exacte (insensible à la casse) (optional)
    ville: ville_example,
    // TypeBienInput (optional)
    type: ...,
    // number | Prix maximum (inclus), en euros (optional)
    prixMax: 8.14,
  } satisfies ListerAnnoncesRequest;

  try {
    const data = await api.listerAnnonces(body);
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
| **page** | `number` | Numéro de page (à partir de 1) | [Optional] [Defaults to `1`] |
| **limit** | `number` | Nombre d\&#39;éléments par page (100 maximum) | [Optional] [Defaults to `20`] |
| **ville** | `string` | Ville exacte (insensible à la casse) | [Optional] [Defaults to `undefined`] |
| **type** | `TypeBienInput` |  | [Optional] [Defaults to `undefined`] [Enum: VENTE, LOCATION] |
| **prixMax** | `number` | Prix maximum (inclus), en euros | [Optional] [Defaults to `undefined`] |

### Return type

[**PageAnnonces**](PageAnnonces.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **400** | Requête invalide (body, query ou path) — VALIDATION_FAILED ou BAD_REQUEST |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mesAnnonces

> PageAnnonces mesAnnonces(page, limit)

Mes annonces (brouillons compris)

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { MesAnnoncesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // number | Numéro de page (à partir de 1) (optional)
    page: 56,
    // number | Nombre d\'éléments par page (100 maximum) (optional)
    limit: 56,
  } satisfies MesAnnoncesRequest;

  try {
    const data = await api.mesAnnonces(body);
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
| **page** | `number` | Numéro de page (à partir de 1) | [Optional] [Defaults to `1`] |
| **limit** | `number` | Nombre d\&#39;éléments par page (100 maximum) | [Optional] [Defaults to `20`] |

### Return type

[**PageAnnonces**](PageAnnonces.md)

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
| **403** | Le rôle ne permet pas l\&#39;opération, ou agent non validé — FORBIDDEN |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## modifierAnnonce

> Annonce modifierAnnonce(id, modifierAnnonceInput)

Modifier une annonce (champs envoyés uniquement)

Propriétaire ou ADMIN. La publication ne se modifie pas ici, mais via /annonces/{id}/publication.

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { ModifierAnnonceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // number | Identifiant numérique de la ressource
    id: 56,
    // ModifierAnnonceInput
    modifierAnnonceInput: ...,
  } satisfies ModifierAnnonceRequest;

  try {
    const data = await api.modifierAnnonce(body);
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
| **modifierAnnonceInput** | [ModifierAnnonceInput](ModifierAnnonceInput.md) |  | |

### Return type

[**Annonce**](Annonce.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **400** | Requête invalide (body, query ou path) — VALIDATION_FAILED ou BAD_REQUEST |  -  |
| **401** | Jeton absent, invalide ou expiré — UNAUTHENTICATED |  -  |
| **403** | Le rôle ne permet pas l\&#39;opération, ou agent non validé — FORBIDDEN |  -  |
| **404** | Ressource inexistante OU appartenant à un autre utilisateur (indiscernables volontairement) — NOT_FOUND |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## publierAnnonce

> Publication publierAnnonce(id)

Publier une annonce

Idempotent : publier une annonce déjà publiée renvoie le même résultat.

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { PublierAnnonceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // number | Identifiant numérique de la ressource
    id: 56,
  } satisfies PublierAnnonceRequest;

  try {
    const data = await api.publierAnnonce(body);
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

[**Publication**](Publication.md)

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
| **403** | Le rôle ne permet pas l\&#39;opération, ou agent non validé — FORBIDDEN |  -  |
| **404** | Ressource inexistante OU appartenant à un autre utilisateur (indiscernables volontairement) — NOT_FOUND |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## supprimerAnnonce

> supprimerAnnonce(id)

Supprimer une annonce

Propriétaire ou ADMIN. 404 si l\&#39;annonce n\&#39;existe pas ou appartient à un autre agent.

### Example

```ts
import {
  Configuration,
  AnnoncesApi,
} from '';
import type { SupprimerAnnonceRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AnnoncesApi(config);

  const body = {
    // number | Identifiant numérique de la ressource
    id: 56,
  } satisfies SupprimerAnnonceRequest;

  try {
    const data = await api.supprimerAnnonce(body);
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

`void` (Empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | Annonce supprimée |  -  |
| **400** | Requête invalide (body, query ou path) — VALIDATION_FAILED ou BAD_REQUEST |  -  |
| **401** | Jeton absent, invalide ou expiré — UNAUTHENTICATED |  -  |
| **403** | Le rôle ne permet pas l\&#39;opération, ou agent non validé — FORBIDDEN |  -  |
| **404** | Ressource inexistante OU appartenant à un autre utilisateur (indiscernables volontairement) — NOT_FOUND |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

