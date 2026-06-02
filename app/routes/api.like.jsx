import { data } from "react-router";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  try {
    console.log("STEP 1 - API HIT");

    // App Proxy Auth
    const { admin } = await authenticate.public.appProxy(request);

    console.log("STEP 2 - AUTH SUCCESS");

    // Request Body
    const body = await request.json();

    console.log("STEP 3 - BODY:", body);

    const { articleId, action } = body;

    console.log("STEP 4 - ARTICLE ID:", articleId);
    console.log("STEP 4 - ACTION:", action);

    if (!articleId) {
      return data(
        {
          success: false,
          error: "articleId is required",
        },
        { status: 400 }
      );
    }

    const requestedAction = action || "like";

    // Get current metafield value
    const query = `
      query GetArticle($id: ID!) {
        article(id: $id) {
          id
          metafield(namespace: "custom", key: "likes_count") {
            value
          }
        }
      }
    `;

    console.log("STEP 5 - RUNNING ARTICLE QUERY");

    const queryResponse = await admin.graphql(query, {
      variables: {
        id: articleId,
      },
    });

    const queryJson = await queryResponse.json();

    console.log(
      "STEP 6 - QUERY RESPONSE:",
      JSON.stringify(queryJson, null, 2)
    );

    const currentLikes = parseInt(
      queryJson?.data?.article?.metafield?.value || "0",
      10
    );

    console.log("STEP 6.1 - CURRENT LIKES:", currentLikes);

    let newLikes = currentLikes;

    if (requestedAction === "like") {
      newLikes = currentLikes + 1;
    } else if (requestedAction === "unlike") {
      newLikes = Math.max(currentLikes - 1, 0);
    }

    console.log("STEP 6.2 - NEW LIKES:", newLikes);

    const mutation = `
      mutation SetLikes($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    console.log("STEP 7 - RUNNING METAFIELD MUTATION");

    const mutationResponse = await admin.graphql(mutation, {
      variables: {
        metafields: [
          {
            ownerId: articleId,
            namespace: "custom",
            key: "likes_count",
            type: "number_integer",
            value: String(newLikes),
          },
        ],
      },
    });

    const mutationJson = await mutationResponse.json();

    console.log(
      "STEP 8 - MUTATION RESPONSE:",
      JSON.stringify(mutationJson, null, 2)
    );

    const errors =
      mutationJson?.data?.metafieldsSet?.userErrors || [];

    if (errors.length > 0) {
      console.error("STEP 9 - USER ERRORS:", errors);

      return data(
        {
          success: false,
          errors,
        },
        { status: 400 }
      );
    }

    console.log("STEP 10 - SUCCESS");

    return data({
      success: true,
      likes: newLikes,
      action: requestedAction,
      articleId,
    });
  } catch (error) {
    console.error("=================================");
    console.error("LIKE API ERROR");
    console.error(error);
    console.error(error?.message);
    console.error(error?.stack);
    console.error("=================================");

    return data(
      {
        success: false,
        error: error?.message || "Unknown error",
        stack: error?.stack || null,
      },
      { status: 500 }
    );
  }
}