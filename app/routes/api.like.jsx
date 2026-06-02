// app/routes/api.like.jsx

import { data } from "react-router";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  try {
    // Authenticate app proxy request
    const { admin } = await authenticate.public.appProxy(request);

    // Get request body
    const body = await request.json();
    const { articleId, action } = body;

    // Validate input
    if (!articleId) {
      return data(
        {
          success: false,
          error: "articleId is required",
        },
        { status: 400 }
      );
    }

    // Default action = like
    const requestedAction = action || "like";

    // Get current likes_count metafield
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

    const queryResponse = await admin.graphql(query, {
      variables: {
        id: articleId,
      },
    });

    const queryJson = await queryResponse.json();

    const currentLikes = parseInt(
      queryJson?.data?.article?.metafield?.value || "0",
      10
    );

    // Calculate new likes count
    let newLikes = currentLikes;

    if (requestedAction === "like") {
      newLikes = currentLikes + 1;
    } else if (requestedAction === "unlike") {
      newLikes = Math.max(currentLikes - 1, 0);
    }

    // Save updated metafield
    const mutation = `
      mutation SetLikes($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

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

    const errors =
      mutationJson?.data?.metafieldsSet?.userErrors || [];

    if (errors.length > 0) {
      return data(
        {
          success: false,
          errors,
        },
        { status: 400 }
      );
    }

    // Return updated count
    return data({
      success: true,
      likes: newLikes,
      action: requestedAction,
      articleId,
    });
  } catch (error) {
    return data(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}