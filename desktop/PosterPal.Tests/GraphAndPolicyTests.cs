using PosterPal.Core.Graph;
using PosterPal.Core.Policy;
using Xunit;

namespace PosterPal.Tests;

public class GraphAndPolicyTests
{
    [Fact]
    public void OAuthUrl_ContainsV26_ExactRedirect_AllScopes_AndState()
    {
        var url = OAuthUrlBuilder.BuildAuthorizeUrl("123", "nonce-abc");
        Assert.Contains("/v26.0/dialog/oauth", url);
        Assert.Contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A55443%2Fcallback%2F", url);
        Assert.Contains("pages_show_list", url);
        Assert.Contains("publish_video", url);
        Assert.Contains("state=nonce-abc", url);
        Assert.Contains("response_type=code", url);
    }

    [Fact]
    public void AppSecretProof_MatchesKnownVector()
    {
        // HMAC-SHA256("token", key="secret") as lowercase hex
        var actual = AppSecretProof.Compute("token", "secret");
        Assert.Equal("e941110e3d2bfe82621f0e3e1434730d7305d106c5f68c87165d0b27a4611a4a", actual);
    }

    [Fact]
    public void PublishPayload_Immediate_UsesPublishedTrue()
    {
        var p = PublishPayloadBuilder.Immediate("hello");
        Assert.True(p.Published);
        Assert.Null(p.ScheduledPublishTime);
        Assert.Null(p.UnpublishedContentType);
    }

    [Fact]
    public void PublishPayload_Schedule_UsesPublishedFalse()
    {
        var p = PublishPayloadBuilder.Schedule("hello", 1_700_000_000);
        Assert.False(p.Published);
        Assert.Equal(1_700_000_000, p.ScheduledPublishTime);
    }

    [Fact]
    public void PublishPayload_Draft_SetsUnpublishedContentType()
    {
        var p = PublishPayloadBuilder.Draft("hello");
        Assert.False(p.Published);
        Assert.Equal("DRAFT", p.UnpublishedContentType);
    }

    [Fact]
    public void PolicyChecklist_FlagsDuplicateCaptions()
    {
        const string caption = "Saturday story hour is back at the river rug with cider for grown-ups.";
        var result = PolicyChecklist.Run(caption, [caption], merchLink: false, hasImages: false, missingAlt: false, createdWithAi: false);
        Assert.False(result.CanPublish);
        Assert.Contains(result.Flags, f => f.Id == "duplicate");
    }

    [Fact]
    public void GraphErrorMapper_190_And_100()
    {
        Assert.Equal("token", GraphErrorMapper.Kind(190, 400, "Invalid OAuth access token"));
        Assert.Equal("invalid_param", GraphErrorMapper.Kind(100, 400, "Unsupported get request"));
    }
}
