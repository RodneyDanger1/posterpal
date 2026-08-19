using System.Security.Cryptography;
using System.Text;

namespace PosterPal.Core.Graph;

public static class AppSecretProof
{
    public static string Compute(string accessToken, string appSecret)
    {
        var key = Encoding.UTF8.GetBytes(appSecret);
        var data = Encoding.UTF8.GetBytes(accessToken);
        var hash = HMACSHA256.HashData(key, data);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}

public static class GraphConstants
{
    public const string Version = "v26.0";
    public const string Base = "https://graph.facebook.com/v26.0";
    public const string Dialog = "https://www.facebook.com/v26.0/dialog/oauth";
    public const string LoopbackRedirect = "http://127.0.0.1:55443/callback/";
    public const string Scopes =
        "pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_engagement,pages_read_user_content,pages_manage_metadata,read_insights,publish_video";
}

public static class OAuthUrlBuilder
{
    public static string BuildAuthorizeUrl(string clientId, string state, string redirectUri = GraphConstants.LoopbackRedirect)
    {
        return $"{GraphConstants.Dialog}?client_id={Uri.EscapeDataString(clientId)}"
            + $"&redirect_uri={Uri.EscapeDataString(redirectUri)}"
            + $"&state={Uri.EscapeDataString(state)}"
            + "&response_type=code"
            + $"&scope={Uri.EscapeDataString(GraphConstants.Scopes)}";
    }
}

public sealed record FeedPublishFields(bool Published, string? Message, string? Link, long? ScheduledPublishTime, string? UnpublishedContentType);

public static class PublishPayloadBuilder
{
    public static FeedPublishFields Immediate(string message, string? link = null) =>
        new(true, message, link, null, null);

    public static FeedPublishFields Schedule(string message, long unixSeconds, string? link = null) =>
        new(false, message, link, unixSeconds, null);

    public static FeedPublishFields Draft(string message, string? link = null) =>
        new(false, message, link, null, "DRAFT");
}

public static class GraphErrorMapper
{
    public static string Kind(int code, int httpStatus, string? message)
    {
        if (code == 190) return "token";
        if (code == 200) return "permission";
        if (code is 4 or 17 or 32 or 613 or 80001) return "rate_limit";
        if (code == 368) return "abusive";
        if (code == 100) return "invalid_param";
        if (code == 1 && message is not null && message.Contains("schedul", StringComparison.OrdinalIgnoreCase))
            return "unknown_schedule";
        if (httpStatus >= 500 || httpStatus == 429) return "server";
        return "other";
    }
}
