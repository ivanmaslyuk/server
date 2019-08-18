const axios = require("axios");

module.exports.fetchPostsByHashtag = async function (hashtag, maxId) {
    let url = `https://www.instagram.com/explore/tags/${hashtag}/?__a=1`;
    if (maxId) {
        url += `&max_id=${maxId}`;
    }
    url = encodeURI(url);

    try {
        const response = await axios.get(url);
        const data = response.data;

        const page = data['graphql']['hashtag']['edge_hashtag_to_media'];
        const hasNextPage = page['page_info']['has_next_page'];
        const endCursor = page['page_info']['end_cursor'];
        const result = {
            posts: [],
            maxId: hasNextPage ? endCursor : null
        }

        const edges = page['edges'];
        edges.forEach((edge) => {
            const node = edge['node'];
            const caption_edge = node['edge_media_to_caption']['edges'][0];
            const caption = caption_edge ? caption_edge['node']['text'] : null

            const post = {
                photoUrl: node['display_url'],
                thumbnailUrl: node['thumbnail_resources'][0]['src'],
                likes: node['edge_liked_by']['count'],
                height: node['dimensions']['height'],
                width: node['dimensions']['width'],
                comments: node['edge_media_to_comment']['count'],
                caption
            };

            result.posts.push(post);
        });

        return result;

    } catch (err) {
        console.log(err);
        console.log(url);
    }
}
