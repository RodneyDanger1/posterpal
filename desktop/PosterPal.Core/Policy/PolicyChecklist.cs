namespace PosterPal.Core.Policy;

public sealed record PolicyFlag(string Id, string Severity, string Title, string Detail);

public sealed record PolicyResult(IReadOnlyList<PolicyFlag> Flags, bool CanPublish, double DuplicateScore);

public static class PolicyChecklist
{
    public static PolicyResult Run(string message, IEnumerable<string> recentCaptions, bool merchLink, bool hasImages, bool missingAlt, bool createdWithAi)
    {
        var flags = new List<PolicyFlag>();
        var caption = message.Trim();
        if (string.IsNullOrWhiteSpace(caption))
        {
            flags.Add(new("empty-caption", "block", "Empty caption", "Write a caption before publishing."));
        }

        var tokens = Tokenize(caption);
        double best = 0;
        foreach (var other in recentCaptions)
        {
            best = Math.Max(best, Jaccard(tokens, Tokenize(other)));
        }

        if (best >= 0.82)
            flags.Add(new("duplicate", "block", "Near-duplicate caption", $"This is {best:P0} similar to a recent post."));
        else if (best >= 0.55)
            flags.Add(new("similar", "warn", "Similar to a recent post", $"Closest match is {best:P0} similar."));

        if (merchLink && caption.IndexOf("#ad", StringComparison.OrdinalIgnoreCase) < 0
            && caption.IndexOf("paid partnership", StringComparison.OrdinalIgnoreCase) < 0)
        {
            flags.Add(new("branded-content", "warn", "Missing branded-content disclosure", "Add #ad or Paid partnership if this is commercial."));
        }

        if (hasImages && missingAlt)
            flags.Add(new("alt-text", "warn", "Missing alt text", "Add alt text for images."));
        if (createdWithAi)
            flags.Add(new("ai-media", "info", "AI-media disclosure reminder", "Disclose synthetic media if required."));

        return new(flags, flags.All(f => f.Severity != "block"), best);
    }

    public static HashSet<string> Tokenize(string text)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var raw in text.ToLowerInvariant().Split(new[] { ' ', '\n', '\t', ',', '.', '!', '?' }, StringSplitOptions.RemoveEmptyEntries))
        {
            if (raw.Length > 1) set.Add(raw);
        }
        return set;
    }

    public static double Jaccard(HashSet<string> a, HashSet<string> b)
    {
        if (a.Count == 0 && b.Count == 0) return 1;
        var inter = a.Intersect(b).Count();
        var union = a.Count + b.Count - inter;
        return union == 0 ? 0 : (double)inter / union;
    }
}
