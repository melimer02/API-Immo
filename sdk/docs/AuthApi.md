# AuthApi

All URIs are relative to *http://localhost:3000*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**connecter**](AuthApi.md#connecter) | **POST** /auth/login | S\&#39;authentifier et obtenir un JWT |
| [**inscrire**](AuthApi.md#inscrire) | **POST** /auth/register | Créer un compte (toujours avec le rôle USER) |
| [**monProfil**](AuthApi.md#monprofil) | **GET** /me | Mon profil |



## connecter

> Jeton connecter(connexionInput)

S\&#39;authentifier et obtenir un JWT

401 avec le même message que l\&#39;email ou le mot de passe soit faux.

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { ConnecterRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // ConnexionInput
    connexionInput: ...,
  } satisfies ConnecterRequest;

  try {
    const data = await api.connecter(body);
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
| **connexionInput** | [ConnexionInput](ConnexionInput.md) |  | |

### Return type

[**Jeton**](Jeton.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **400** | Requête invalide (body, query ou path) — VALIDATION_FAILED ou BAD_REQUEST |  -  |
| **401** | Email ou mot de passe incorrect — INVALID_CREDENTIALS |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## inscrire

> Profil inscrire(inscriptionInput)

Créer un compte (toujours avec le rôle USER)

Un champ role envoyé par le client est ignoré. 409 si l\&#39;email est déjà utilisé.

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { InscrireRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AuthApi();

  const body = {
    // InscriptionInput
    inscriptionInput: ...,
  } satisfies InscrireRequest;

  try {
    const data = await api.inscrire(body);
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
| **inscriptionInput** | [InscriptionInput](InscriptionInput.md) |  | |

### Return type

[**Profil**](Profil.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Default Response |  -  |
| **400** | Requête invalide (body, query ou path) — VALIDATION_FAILED ou BAD_REQUEST |  -  |
| **409** | Conflit avec l\&#39;état actuel — EMAIL_ALREADY_USED, QUESTION_ALREADY_ANSWERED |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## monProfil

> Profil monProfil()

Mon profil

### Example

```ts
import {
  Configuration,
  AuthApi,
} from '';
import type { MonProfilRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AuthApi(config);

  try {
    const data = await api.monProfil();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Profil**](Profil.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Default Response |  -  |
| **401** | Jeton absent, invalide ou expiré — UNAUTHENTICATED |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

